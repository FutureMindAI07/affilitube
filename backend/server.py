from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import csv
import json
import io
import asyncio
import contextvars
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from jose import jwt, JWTError
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection.
# Timeouts + retries are tuned for MongoDB Atlas cold-start behaviour observed
# in Emergent Kubernetes deployments: first requests can hit brief network hiccups
# so we (a) give server selection a bigger window, (b) bound socket ops so a
# stuck read doesn't tie up a request for minutes, and (c) enable retryable
# reads/writes so transient blips don't surface as 500s to the user.
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000,
    connectTimeoutMS=20000,
    socketTimeoutMS=30000,
    retryReads=True,
    retryWrites=True,
    tz_aware=True,
)
db = client[os.environ.get('DB_NAME', 'affilitube_db')]

# Auth config
JWT_SECRET = os.environ.get("JWT_SECRET", str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


# ============================================================================
# Event-loop-friendly helpers
# ----------------------------------------------------------------------------
# The googleapiclient SDK is *synchronous* — every .execute() call is a
# blocking HTTP roundtrip running on the asyncio thread. Likewise passlib
# bcrypt verify/hash burns 50-200ms of pure CPU on the loop thread. Either
# can stall the single uvicorn worker long enough that user-facing requests
# (login, /me, etc.) sit in the queue and hit the 120s gateway timeout.
#
# These helpers dispatch the blocking work to the default ThreadPoolExecutor
# (sized min(32, os.cpu_count()+4)) so the event loop stays responsive.
# Drop-in replacements: each callsite that previously did `.execute()` or
# `pwd_context.verify(...)` becomes `await _yt_execute(...)` /
# `await _verify_password(...)`.
# ============================================================================

async def _yt_execute(request):
    """Run a googleapiclient request.execute() off the event loop thread.

    Also fire-and-forget records the call to the quota-usage collection so the
    admin dashboard can report YouTube API consumption per key (admin vs regular).
    Tracking never blocks the caller and never raises.
    """
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, request.execute)
    try:
        key_label = _current_yt_key_ctx.get()
        uri = getattr(request, "uri", "") or ""
        m = re.search(r"/youtube/v3/([a-zA-Z]+)", uri)
        op = m.group(1) if m else "unknown"
        units = _YT_QUOTA_UNITS.get(op, 1)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        asyncio.create_task(_record_yt_quota(today, key_label, op, units))
    except Exception:
        pass
    return result


# YouTube API v3 quota unit costs per operation.
# https://developers.google.com/youtube/v3/determine_quota_cost
_YT_QUOTA_UNITS = {
    "search": 100,
    "channels": 1,
    "playlistItems": 1,
    "videos": 1,
    "commentThreads": 1,
    "comments": 1,
}
# Standard YouTube Data API v3 free daily quota — used as the "% of budget"
# reference on the quota-status endpoint. Both keys share this limit
# independently per Google project.
_YT_DAILY_QUOTA_LIMIT = 10000
# Set by get_youtube_service() so _yt_execute knows which key just made a call.
# ContextVar is asyncio-task-scoped, so concurrent requests never collide.
_current_yt_key_ctx: "contextvars.ContextVar[str]" = contextvars.ContextVar(
    "yt_key", default="regular"
)


async def _record_yt_quota(date_str: str, key_label: str, op: str, units: int) -> None:
    """Fire-and-forget quota counter. Never raises to the caller."""
    try:
        await db.yt_quota_usage.update_one(
            {"date": date_str, "key": key_label, "operation": op},
            {
                "$inc": {"calls": 1, "units": units},
                "$setOnInsert": {
                    "date": date_str,
                    "key": key_label,
                    "operation": op,
                },
            },
            upsert=True,
        )
    except Exception:
        logger.debug("yt quota tracking write failed", exc_info=True)


async def _verify_password(plain: str, hashed: str) -> bool:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, pwd_context.verify, plain, hashed)


async def _hash_password(plain: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, pwd_context.hash, plain)

# Encryption for API keys at rest (kept for any future encrypted data)
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", JWT_SECRET)
_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(ENCRYPTION_KEY.encode()).digest())
fernet = Fernet(_fernet_key)

def encrypt_value(plaintext: str) -> str:
    return fernet.encrypt(plaintext.encode()).decode()

def decrypt_value(ciphertext: str) -> str:
    return fernet.decrypt(ciphertext.encode()).decode()

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pacific timezone for quota reset
PACIFIC_TZ = ZoneInfo("America/Los_Angeles")

# ==================== TIER SYSTEM ====================

# User tiers
TIERS = {
    "free": {
        "name": "Free",
        "searches_per_month": 3,
        "max_results_per_search": 50,
        "csv_export": False,
        "saved_searches": False,
        "saved_reports": False,
        "pipeline_access": False,
        "max_pipeline_projects": 0
    },
    "starter": {
        "name": "Starter",
        "searches_per_month": 20,
        "max_results_per_search": None,
        "csv_export": True,
        "saved_searches": True,
        "saved_reports": True,
        "pipeline_access": True,
        "max_pipeline_projects": 3
    },
    "pro": {
        "name": "Pro",
        "searches_per_month": 100,
        "max_results_per_search": None,
        "csv_export": True,
        "saved_searches": True,
        "saved_reports": True,
        "pipeline_access": True,
        "max_pipeline_projects": None
    },
    "appsumo": {
        "name": "AppSumo",
        "searches_per_month": None,  # Unlimited
        "max_results_per_search": None,  # No limit
        "csv_export": True,
        "saved_searches": True,
        "saved_reports": True,
        "pipeline_access": True,
        "max_pipeline_projects": None  # Unlimited
    }
}

def get_user_tier(user: dict) -> str:
    """Get user's tier, defaulting to free"""
    return user.get("tier", "free")

def get_tier_config(tier: str) -> dict:
    """Get tier configuration"""
    return TIERS.get(tier, TIERS["free"])

async def check_search_limit(user: dict) -> dict:
    """Check if user can perform a search based on their tier limits"""
    # Admin is exempt from all search limits
    if user.get("role") == "admin":
        return {"can_search": True, "searches_remaining": None, "tier": "pro", "warning": None}

    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    
    # Unlimited tier (appsumo legacy)
    if tier_config["searches_per_month"] is None:
        return {"can_search": True, "searches_remaining": None, "tier": tier, "warning": None}
    
    # Get current month's search count
    user_id = user["id"]
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    
    # Check if we need to reset the count
    user_data = await db.users.find_one({"id": user_id})
    reset_date = user_data.get("search_count_reset_date", "")
    
    if not reset_date or not reset_date.startswith(current_month):
        # Reset count for new month
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"monthly_search_count": 0, "search_count_reset_date": current_month}}
        )
        search_count = 0
    else:
        search_count = user_data.get("monthly_search_count", 0)
    
    max_searches = tier_config["searches_per_month"]
    can_search = search_count < max_searches
    searches_remaining = max(0, max_searches - search_count)
    
    # Warning at 80% threshold
    warning = None
    warning_threshold = int(max_searches * 0.8)
    if search_count >= max_searches:
        warning = "limit_reached"
    elif search_count >= warning_threshold:
        warning = "approaching_limit"
    
    return {
        "can_search": can_search,
        "searches_used": search_count,
        "searches_remaining": searches_remaining,
        "max_searches": max_searches,
        "tier": tier,
        "warning": warning,
    }

async def increment_search_count(user_id: str):
    """Increment user's monthly search count"""
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"monthly_search_count": 1}}
    )

# ==================== NICHE CONFIGURATION ====================

NICHE_CONFIGS = {
    "saas_software": {
        "name": "SaaS & Software",
        "icon": "💻",
        "description": "Software tools, automation, no-code, integrations, app reviews",
        "topic_keywords": [
            'automation', 'workflow', 'zapier', 'make', 'n8n', 'no-code', 'nocode', 
            'ai tools', 'integrations', 'api', 'saas', 'software', 'app review',
            'productivity', 'tool review', 'notion', 'airtable', 'clickup'
        ],
        "affiliate_signal_keywords": [
            'best tools', 'top tools', 'review', 'vs', 'comparison', 'automation tools', 
            'ai tools', 'software review', 'tool stack', 'my tools', 'alternatives'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'lifetime deal', 'appsumo', 'review', 'comparison', 'vs',
            'best tools', 'top tools', 'my tech stack', 'tools i use'
        ],
        "commercial_keywords": [
            'course', 'coaching', 'consulting', 'templates', 'download',
            'training', 'community', 'gumroad', 'udemy', 'academy',
            'masterclass', 'workshop', 'ebook', 'free guide', 'newsletter'
        ],
        "placeholder_examples": "automation tutorial\nbest no-code tools\nzapier alternative\nsaas review"
    },
    "fitness_health": {
        "name": "Fitness & Health",
        "icon": "💪",
        "description": "Workouts, nutrition, supplements, fitness gear, health products",
        "topic_keywords": [
            'workout', 'fitness', 'gym', 'exercise', 'nutrition', 'diet', 'protein',
            'supplements', 'weight loss', 'muscle', 'strength training', 'cardio',
            'yoga', 'hiit', 'calisthenics', 'bodybuilding', 'health', 'wellness'
        ],
        "affiliate_signal_keywords": [
            'best supplements', 'top protein', 'review', 'vs', 'comparison', 
            'fitness gear', 'workout equipment', 'my supplements', 'what i eat'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'my supplements', 'gear i use', 'review', 'comparison',
            'best products', 'top picks', 'my stack'
        ],
        "commercial_keywords": [
            'program', 'coaching', 'meal plan', 'training plan', 'download',
            'ebook', 'community', 'challenge', 'transformation',
            'online coaching', 'personal training', 'free guide'
        ],
        "placeholder_examples": "home workout routine\nbest protein powder\nfitness gear review\nweight loss tips"
    },
    "finance_investing": {
        "name": "Finance & Investing",
        "icon": "💰",
        "description": "Investing, personal finance, crypto, trading, budgeting tools",
        "topic_keywords": [
            'investing', 'stocks', 'crypto', 'bitcoin', 'trading', 'finance',
            'money', 'budget', 'passive income', 'dividend', 'real estate',
            'wealth', 'retirement', 'savings', 'side hustle', 'financial freedom'
        ],
        "affiliate_signal_keywords": [
            'best brokers', 'top apps', 'review', 'vs', 'comparison', 
            'trading platform', 'budgeting app', 'my portfolio', 'how i invest'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'sign up bonus', 'free stock',
            'deal', 'review', 'comparison', 'vs', 'best apps', 'top platforms',
            'my broker', 'tools i use'
        ],
        "commercial_keywords": [
            'course', 'coaching', 'community', 'mastermind', 'download',
            'ebook', 'trading group', 'signals', 'newsletter',
            'membership', 'patreon', 'free guide'
        ],
        "placeholder_examples": "passive income ideas\nstock market beginner\nbest budgeting app\ncrypto explained"
    },
    "ecommerce_amazon": {
        "name": "Ecommerce & Amazon",
        "icon": "🛒",
        "description": "Product reviews, Amazon finds, dropshipping, online shopping",
        "topic_keywords": [
            'amazon', 'product review', 'unboxing', 'haul', 'dropshipping',
            'ecommerce', 'shopify', 'online shopping', 'gadgets', 'tech review',
            'best products', 'amazon finds', 'wish list', 'must haves'
        ],
        "affiliate_signal_keywords": [
            'best products', 'top finds', 'review', 'vs', 'comparison', 
            'amazon haul', 'unboxing', 'my favorites', 'must buy', 'worth it'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'amazon affiliate', 'links below',
            'deal', 'review', 'comparison', 'best finds', 'top picks',
            'my favorites', 'must haves'
        ],
        "commercial_keywords": [
            'course', 'coaching', 'dropshipping course', 'ecommerce course',
            'community', 'mentorship', 'download', 'ebook',
            'free guide', 'shopify store'
        ],
        "placeholder_examples": "amazon finds\nbest products under $50\ndropshipping tutorial\nproduct review"
    },
    "online_courses": {
        "name": "Online Courses & Education",
        "icon": "📚",
        "description": "Online learning, courses, skills, tutorials, certifications",
        "topic_keywords": [
            'online course', 'learn', 'tutorial', 'education', 'skillshare',
            'udemy', 'coursera', 'programming', 'coding', 'design', 'language',
            'certification', 'study', 'free course', 'masterclass'
        ],
        "affiliate_signal_keywords": [
            'best courses', 'top platforms', 'review', 'vs', 'comparison', 
            'course review', 'worth it', 'my experience', 'honest review'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'free trial',
            'deal', 'review', 'comparison', 'best courses', 'top platforms',
            'my recommendation'
        ],
        "commercial_keywords": [
            'my course', 'coaching', 'mentorship', 'community', 'download',
            'ebook', 'free guide', 'newsletter', 'patreon',
            'membership', 'exclusive content'
        ],
        "placeholder_examples": "best online courses\nlearn python free\nskillshare review\nudemy vs coursera"
    },
    "marketing_tools": {
        "name": "Marketing Tools",
        "icon": "📈",
        "description": "SEO, email marketing, social media tools, marketing software",
        "topic_keywords": [
            'seo', 'marketing', 'email marketing', 'social media', 'content marketing',
            'digital marketing', 'facebook ads', 'google ads', 'copywriting',
            'conversion', 'analytics', 'growth hacking', 'affiliate marketing'
        ],
        "affiliate_signal_keywords": [
            'best seo tools', 'top marketing tools', 'review', 'vs', 'comparison', 
            'email platform', 'my tools', 'marketing stack', 'how i rank'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best tools', 'top platforms',
            'my tech stack', 'tools i use'
        ],
        "commercial_keywords": [
            'course', 'coaching', 'consulting', 'agency', 'download',
            'templates', 'community', 'ebook', 'free guide', 'newsletter',
            'masterclass', 'workshop'
        ],
        "placeholder_examples": "best SEO tools\nemail marketing tutorial\nsocial media strategy\nahrefs review"
    },
    "beauty_skincare": {
        "name": "Beauty & Skincare",
        "icon": "💄",
        "description": "Makeup, skincare routines, beauty products, cosmetics reviews",
        "topic_keywords": [
            'makeup', 'skincare', 'beauty', 'cosmetics', 'skincare routine', 'foundation',
            'moisturizer', 'serum', 'cleanser', 'anti-aging', 'acne', 'sunscreen',
            'hair care', 'nails', 'lipstick', 'eyeshadow', 'contour', 'glow up'
        ],
        "affiliate_signal_keywords": [
            'best skincare', 'top makeup', 'review', 'vs', 'comparison',
            'holy grail products', 'my routine', 'drugstore vs high end', 'dupes'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best products', 'favorites',
            'my routine', 'products i use', 'holy grail'
        ],
        "commercial_keywords": [
            'course', 'masterclass', 'ebook', 'free guide', 'newsletter',
            'my brand', 'shop my', 'affiliate links', 'discount',
            'promo code', 'collab'
        ],
        "placeholder_examples": "skincare routine for beginners\nbest drugstore makeup\nthe ordinary review\nmorning skincare routine"
    },
    "travel": {
        "name": "Travel",
        "icon": "✈️",
        "description": "Travel gear, booking tools, travel credit cards, destination guides",
        "topic_keywords": [
            'travel', 'vacation', 'trip', 'destination', 'flight', 'hotel', 'airbnb',
            'backpacking', 'travel hack', 'travel tips', 'packing', 'luggage',
            'travel credit card', 'miles', 'points', 'budget travel', 'luxury travel'
        ],
        "affiliate_signal_keywords": [
            'best travel gear', 'top travel cards', 'review', 'vs', 'comparison',
            'travel essentials', 'packing list', 'my travel setup', 'how i book'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'sign up bonus', 'referral bonus',
            'deal', 'review', 'comparison', 'best cards', 'travel hack',
            'gear i use', 'travel essentials'
        ],
        "commercial_keywords": [
            'course', 'ebook', 'travel guide', 'itinerary', 'download',
            'presets', 'lightroom', 'community', 'patreon',
            'membership', 'exclusive content'
        ],
        "placeholder_examples": "best travel credit cards\ncarry on packing tips\ntravel hack tutorial\nbudget travel guide"
    },
    "gaming": {
        "name": "Gaming",
        "icon": "🎮",
        "description": "Gaming peripherals, game reviews, streaming setup, game keys",
        "topic_keywords": [
            'gaming', 'game review', 'gameplay', 'walkthrough', 'streaming', 'twitch',
            'gaming setup', 'gaming chair', 'gaming mouse', 'keyboard', 'headset',
            'pc build', 'console', 'playstation', 'xbox', 'nintendo', 'esports'
        ],
        "affiliate_signal_keywords": [
            'best gaming', 'top peripherals', 'review', 'vs', 'comparison',
            'my setup', 'gaming gear', 'streaming setup', 'pc build guide'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best gear', 'my setup',
            'gear i use', 'amazon affiliate'
        ],
        "commercial_keywords": [
            'merch', 'membership', 'patreon', 'discord', 'community',
            'coaching', 'boosting', 'download', 'stream overlay',
            'emotes', 'sub goal'
        ],
        "placeholder_examples": "best gaming mouse 2024\nstreaming setup tour\ngame review\npc build guide"
    },
    "home_diy": {
        "name": "Home & DIY",
        "icon": "🏠",
        "description": "Home improvement, tools, interior design, smart home products",
        "topic_keywords": [
            'diy', 'home improvement', 'renovation', 'interior design', 'decor',
            'smart home', 'tools', 'woodworking', 'painting', 'flooring',
            'furniture', 'organization', 'cleaning', 'garden', 'landscaping'
        ],
        "affiliate_signal_keywords": [
            'best tools', 'top products', 'review', 'vs', 'comparison',
            'my tools', 'home tour', 'room makeover', 'amazon finds'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best products', 'tools i use',
            'amazon affiliate', 'home depot'
        ],
        "commercial_keywords": [
            'plans', 'blueprints', 'templates', 'ebook', 'course',
            'workshop', 'community', 'patreon', 'membership',
            'free guide', 'download'
        ],
        "placeholder_examples": "smart home setup\nbest power tools\nroom makeover on a budget\ndiy furniture build"
    },
    "pet_care": {
        "name": "Pet Care",
        "icon": "🐾",
        "description": "Pet food, accessories, vet products, pet training",
        "topic_keywords": [
            'dog', 'cat', 'pet', 'puppy', 'kitten', 'pet food', 'dog food', 'cat food',
            'pet training', 'dog training', 'pet toys', 'pet accessories', 'grooming',
            'vet', 'pet health', 'aquarium', 'fish', 'bird', 'reptile'
        ],
        "affiliate_signal_keywords": [
            'best pet food', 'top pet products', 'review', 'vs', 'comparison',
            'my pet routine', 'pet essentials', 'what i feed', 'pet haul'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best products', 'favorites',
            'chewy affiliate', 'amazon affiliate'
        ],
        "commercial_keywords": [
            'course', 'training program', 'ebook', 'free guide', 'community',
            'patreon', 'membership', 'merch', 'shop',
            'download', 'printable'
        ],
        "placeholder_examples": "best dog food brands\npuppy training tips\ncat toy review\npet grooming tutorial"
    },
    "personal_development": {
        "name": "Personal Development",
        "icon": "🧠",
        "description": "Productivity tools, books, coaching programs, mindset",
        "topic_keywords": [
            'productivity', 'self improvement', 'mindset', 'motivation', 'habits',
            'goal setting', 'time management', 'morning routine', 'journaling',
            'meditation', 'book summary', 'book review', 'stoicism', 'success'
        ],
        "affiliate_signal_keywords": [
            'best books', 'top productivity apps', 'review', 'vs', 'comparison',
            'my routine', 'tools i use', 'book recommendations', 'habit tracker'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best apps', 'books i recommend',
            'audible affiliate', 'amazon affiliate'
        ],
        "commercial_keywords": [
            'course', 'coaching', 'mentorship', 'community', 'ebook',
            'planner', 'templates', 'notion templates', 'free guide',
            'masterclass', 'workshop', 'program'
        ],
        "placeholder_examples": "morning routine for success\nbest productivity apps\nbook summary\nhabit building tips"
    },
    "food_cooking": {
        "name": "Food & Cooking",
        "icon": "🍳",
        "description": "Kitchen equipment, meal kits, recipe apps, cooking tools",
        "topic_keywords": [
            'cooking', 'recipe', 'kitchen', 'meal prep', 'baking', 'air fryer',
            'instant pot', 'kitchen gadgets', 'meal kit', 'food review',
            'restaurant', 'chef', 'healthy eating', 'vegan', 'keto'
        ],
        "affiliate_signal_keywords": [
            'best kitchen gadgets', 'top cookware', 'review', 'vs', 'comparison',
            'my kitchen', 'kitchen tour', 'must have tools', 'meal kit review'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best products', 'kitchen essentials',
            'amazon affiliate', 'my favorites'
        ],
        "commercial_keywords": [
            'cookbook', 'recipe ebook', 'meal plan', 'course', 'community',
            'patreon', 'membership', 'merch', 'shop',
            'download', 'printable recipes'
        ],
        "placeholder_examples": "air fryer recipes\nbest kitchen gadgets\nmeal prep for beginners\nmeal kit review"
    },
    "tech_gadgets": {
        "name": "Tech & Gadgets",
        "icon": "📱",
        "description": "Consumer electronics, gadget reviews, tech comparisons",
        "topic_keywords": [
            'tech', 'gadget', 'smartphone', 'iphone', 'android', 'laptop', 'tablet',
            'earbuds', 'headphones', 'smartwatch', 'camera', 'drone', 'unboxing',
            'tech review', 'apple', 'samsung', 'google', 'wireless'
        ],
        "affiliate_signal_keywords": [
            'best tech', 'top gadgets', 'review', 'vs', 'comparison',
            'unboxing', 'first impressions', 'my setup', 'tech i use'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in description', 'discount code', 'coupon',
            'deal', 'review', 'comparison', 'vs', 'best products', 'my gear',
            'amazon affiliate', 'check links below'
        ],
        "commercial_keywords": [
            'merch', 'membership', 'patreon', 'community', 'discord',
            'wallpapers', 'presets', 'course', 'workshop',
            'exclusive content', 'newsletter'
        ],
        "placeholder_examples": "best smartphones 2024\niphone vs android\ntech gadget review\nwireless earbuds comparison"
    },
    "fashion": {
        "name": "Fashion & Style",
        "icon": "👗",
        "description": "Outfits, hauls, capsule wardrobes, style tips, fashion product reviews",
        "topic_keywords": [
            'fashion', 'outfit', 'ootd', 'style', 'wardrobe', 'capsule wardrobe',
            'try on haul', 'clothing haul', 'thrift haul', 'streetwear', 'workwear',
            'athleisure', 'petite fashion', 'plus size fashion', 'minimalist fashion',
            'jewelry', 'shoes', 'handbags', 'accessories'
        ],
        "affiliate_signal_keywords": [
            'try on', 'haul', 'review', 'vs', 'comparison', 'wardrobe essentials',
            'what i wore', 'my closet', 'dupes', 'worth the money', 'best of'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in bio', 'link in description', 'discount code',
            'coupon', 'shop my', 'ltk', 'shop the look',
            'gifted', 'pr package', 'linked below', 'linked'
        ],
        "commercial_keywords": [
            'shop my closet', 'my brand', 'my line', 'collection',
            'presets', 'lightroom', 'ebook', 'lookbook', 'download',
            'patreon', 'community', 'newsletter', 'linktree', 'ltk'
        ],
        "placeholder_examples": "capsule wardrobe basics\nzara try on haul\nnordstrom anniversary sale\nfall outfit ideas"
    },
    "lifestyle": {
        "name": "Lifestyle & Vlogs",
        "icon": "✨",
        "description": "Day in the life, routines, aesthetic living, minimalism, favorites & haul videos",
        "topic_keywords": [
            'lifestyle', 'vlog', 'day in my life', 'daily vlog', 'morning routine',
            'night routine', 'productivity', 'minimalism', 'aesthetic', 'that girl',
            'romanticize your life', 'weekly vlog', 'reset day', 'sunday reset',
            'apartment tour', 'monthly favorites', 'come with me', 'slow living'
        ],
        "affiliate_signal_keywords": [
            'favorites', 'monthly favorites', 'must haves', 'review', 'haul',
            'what i use', 'my routine', 'best of', 'worth it', 'holy grail'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in bio', 'link in description', 'discount code',
            'coupon', 'shop my', 'ltk', 'amazon storefront',
            'gifted', 'pr package', 'linked below', 'products mentioned'
        ],
        "commercial_keywords": [
            'presets', 'lightroom', 'notion template', 'ebook', 'download',
            'planner', 'community', 'newsletter', 'patreon', 'linktree',
            'coaching', 'my course', 'shop my'
        ],
        "placeholder_examples": "morning routine\nday in my life\napartment tour\nmonthly favorites"
    },
    "parenting": {
        "name": "Parenting & Family",
        "icon": "👶",
        "description": "Baby gear, mom vlogs, kids products, pregnancy, family life, registry reviews",
        "topic_keywords": [
            'parenting', 'mom vlog', 'family vlog', 'pregnancy', 'newborn', 'baby',
            'toddler', 'baby gear', 'baby must haves', 'baby registry', 'nursery',
            'stroller', 'car seat', 'baby carrier', 'diapers', 'breastfeeding',
            'postpartum', 'kids toys', 'back to school', 'mom life', 'dad life'
        ],
        "affiliate_signal_keywords": [
            'baby must haves', 'baby registry', 'review', 'vs', 'comparison',
            'best baby', 'top baby', 'what i registered for', 'first time mom',
            'worth it', 'do not buy'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in bio', 'link in description', 'discount code',
            'coupon', 'amazon storefront', 'linked below',
            'gifted', 'pr package', 'products mentioned', 'shop my'
        ],
        "commercial_keywords": [
            'course', 'ebook', 'birth course', 'sleep course', 'community',
            'membership', 'patreon', 'coaching', 'newsletter', 'download',
            'my brand', 'linktree'
        ],
        "placeholder_examples": "baby registry must haves\npregnancy vlog\ntoddler morning routine\nstroller review"
    },
    "home_decor": {
        "name": "Home & Decor",
        "icon": "🛋️",
        "description": "Interior design, home tours, DIY, home hauls, decor products, organization",
        "topic_keywords": [
            'home decor', 'interior design', 'home tour', 'apartment tour',
            'apartment makeover', 'small space', 'cozy home', 'aesthetic decor',
            'organization', 'kitchen organization', 'closet organization',
            'diy home', 'ikea haul', 'target home haul', 'amazon home finds',
            'house plants', 'rug', 'furniture', 'lighting', 'bedroom refresh'
        ],
        "affiliate_signal_keywords": [
            'home haul', 'amazon home finds', 'target home haul', 'best home',
            'review', 'vs', 'comparison', 'my favorites', 'must haves',
            'worth it', 'what i bought'
        ],
        "affiliate_language_keywords": [
            'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
            'use my link', 'link in bio', 'link in description', 'discount code',
            'coupon', 'amazon storefront', 'shop my home',
            'ltk home', 'gifted', 'linked below', 'products mentioned'
        ],
        "commercial_keywords": [
            'ebook', 'download', 'design services', 'e-design', 'consulting',
            'course', 'community', 'newsletter', 'patreon', 'linktree',
            'my shop', 'presets'
        ],
        "placeholder_examples": "small apartment tour\namazon home finds\nikea kitchen hack\ncozy bedroom refresh"
    }
}

def get_niche_config(niche: str) -> dict:
    """Get niche configuration, defaulting to SaaS if not found"""
    return NICHE_CONFIGS.get(niche, NICHE_CONFIGS["saas_software"])

# ==================== QUOTA TRACKING ====================

# API call costs
QUOTA_COSTS = {
    "search": 100,
    "channels": 1,
    "playlists": 1,
    "videos": 1,
}

async def get_today_pacific():
    """Get today's date in Pacific timezone"""
    now_pacific = datetime.now(PACIFIC_TZ)
    return now_pacific.strftime("%Y-%m-%d")

async def get_quota_usage(user_id: str = None):
    """Get current quota usage for today"""
    today = await get_today_pacific()
    query = {"date": today}
    if user_id:
        query["user_id"] = user_id
    usage = await db.quota_usage.find_one(query, {"_id": 0})
    if not usage:
        usage = {
            "date": today,
            "search_calls": 0,
            "channel_calls": 0,
            "playlist_calls": 0,
            "video_calls": 0,
            "total_units": 0,
            "quota_exceeded_at": None
        }
    return usage

async def track_api_call(call_type: str, count: int = 1, user_id: str = None):
    """Track an API call and update quota usage"""
    today = await get_today_pacific()
    cost = QUOTA_COSTS.get(call_type, 1) * count
    
    field_map = {
        "search": "search_calls",
        "channels": "channel_calls",
        "playlists": "playlist_calls",
        "videos": "video_calls"
    }
    field = field_map.get(call_type, "video_calls")
    
    query = {"date": today}
    if user_id:
        query["user_id"] = user_id
    
    await db.quota_usage.update_one(
        query,
        {
            "$inc": {field: count, "total_units": cost},
            "$setOnInsert": {"quota_exceeded_at": None, "user_id": user_id}
        },
        upsert=True
    )

async def mark_quota_exceeded(user_id: str = None):
    """Mark quota as exceeded with timestamp"""
    today = await get_today_pacific()
    query = {"date": today}
    if user_id:
        query["user_id"] = user_id
    await db.quota_usage.update_one(
        query,
        {"$set": {"quota_exceeded_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

def get_quota_reset_time():
    """Calculate time until midnight Pacific"""
    now_pacific = datetime.now(PACIFIC_TZ)
    midnight_pacific = (now_pacific + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    delta = midnight_pacific - now_pacific
    return {
        "reset_at": midnight_pacific.isoformat(),
        "seconds_until_reset": int(delta.total_seconds()),
        "hours": delta.seconds // 3600,
        "minutes": (delta.seconds % 3600) // 60,
        "seconds": delta.seconds % 60
    }

# ==================== MODELS ====================

class AuthRegister(BaseModel):
    email: str
    password: str
    trial: Optional[str] = None

class AuthLogin(BaseModel):
    email: str
    password: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class BugReportInput(BaseModel):
    subject: str
    description: str
    steps_to_reproduce: str = ""
    severity: str = "medium"

class PartnerApplicationInput(BaseModel):
    full_name: str
    email: str
    promotion_experience: str = ""

class SearchFilters(BaseModel):
    keywords: List[str]
    exclude_keywords: List[str] = []
    niche: str = "saas_software"  # NEW: Niche parameter
    min_subscribers: int = 2000
    max_subscribers: int = 100000
    uploaded_within_days: int = 90
    max_results_per_keyword: int = 50
    search_mode: str = "channels_videos"  # channels_only, videos_only, channels_videos
    # Advanced settings
    videos_to_scan: int = 5  # 1-20
    scan_video_descriptions: bool = False
    max_channels_to_enrich: Optional[int] = None  # None = all, or 50-500
    affiliate_platforms: List[str] = []  # List of platform keys to detect

class EnrichRequest(BaseModel):
    channel_ids: List[str]
    channel_metadata: Dict[str, Dict] = {}
    niche: str = "saas_software"  # NEW: Niche parameter
    min_subscribers: int = 2000
    max_subscribers: int = 100000
    videos_to_scan: int = 5
    scan_video_descriptions: bool = False
    max_channels_to_enrich: Optional[int] = None
    affiliate_platforms: List[str] = []
    uploaded_within_days: Optional[int] = None
    hide_pipeline_channels: bool = False
    super_search: bool = False
    competitor_brands: List[str] = []
    strict_mode: bool = False  # Super Search: require proven affiliate activity (current legacy hard filters)
    target_countries: List[str] = []  # ISO 3166-1 alpha-2 codes, empty = no filter
    include_unknown_country: bool = True  # When target_countries is set, also include channels with no declared country

# ===== MASTER AFFILIATE LINK PATTERNS (single source of truth) =====
# Used by BOTH detect_sponsorships() AND detect_affiliate_platform_links()
MASTER_AFFILIATE_LINK_PATTERNS = [
    # Amazon
    r"amzn\.to/",
    r"amazon\.[\w.]+/.*(?:tag=|ref=)",
    # Amazon Influencer storefronts
    r"amazon\.[\w.]+/shop/",
    # AppSumo
    r"8odi\.net/",
    r"appsumo\.com/",
    # LTK / RewardStyle
    r"liketoknow\.it/",
    r"rewardstyle\.com/",
    r"shopltk\.com/",
    # Walmart Creator
    r"walmart\.com/.*[?&]adid=",
    # Sovrn / VigLink
    r"viglink\.com/",
    # Impact / PartnerStack
    r"impact\.com/",
    r"impactradius\.com/",
    r"pxf\.io/",
    r"sjv\.io/",
    r"7eer\.net/",
    r"partnerstack\.com/",
    r"pstk\.io/",
    # ShareASale
    r"shareasale\.com/",
    # CJ Affiliate
    r"cj\.com/",
    r"commission-junction\.com/",
    r"dpbolvw\.net/",
    r"jdoqocy\.com/",
    r"tkqlhce\.com/",
    r"anrdoezrs\.net/",
    # Awin
    r"awin1\.com/",
    r"zenaps\.com/",
    # Rakuten
    r"rakuten\.com/",
    r"linksynergy\.com/",
    r"click\.linksynergy\.com/",
    # ClickBank
    r"clickbank\.net/",
    r"hop\.clickbank\.net/",
    # Gumroad
    r"gumroad\.com/",
    r"gum\.co/",
    # Skimlinks
    r"skimlinks\.com/",
    r"skimresources\.com/",
    r"go\.redirectingat\.com/",
    # FlexOffers
    r"flexoffers\.com/",
    # Shorteners & creator storefronts
    r"bit\.ly/",
    r"tinyurl\.com/",
    r"linktr\.ee/",
    r"stan\.store/",
    r"geni\.us/",
    r"kit\.co/",
    # Other affiliate networks & tools
    r"go\.magik\.ly/",
    r"shrsl\.com/",
    r"rstyle\.me/",
    r"howl\.me/",
    r"shopmy\.us/",
    r"lvndr\.com/",
    r"mavely\.co/",
    r"collabs\.shop/",
    r"glnk\.io/",
    r"prf\.hn/",
    r"partnerize\.com/",
    # Generic affiliate markers
    r"(?:commission|affiliate|partner|ref)[_\-]?(?:link|url|id)",
]

# Affiliate platform URL patterns (for platform-specific detection in enrichment)
AFFILIATE_PLATFORMS = {
    "appsumo": {
        "name": "AppSumo",
        "patterns": ["appsumo.com", "appsumo.8odi.net"]
    },
    "amazon": {
        "name": "Amazon Associates", 
        "patterns": ["amzn.to", "amazon.com/.*[?&]tag=", "amazon.co.uk/.*[?&]tag=", "amazon.com/shop", "amazon.co.uk/shop"]
    },
    "impact": {
        "name": "Impact",
        "patterns": ["impact.com", "pxf.io", "sjv.io", "7eer.net"]
    },
    "partnerstack": {
        "name": "PartnerStack",
        "patterns": ["partnerstack.com", "pstk.io"]
    },
    "shareasale": {
        "name": "ShareASale",
        "patterns": ["shareasale.com", "shrsl.com"]
    },
    "cj": {
        "name": "CJ Affiliate",
        "patterns": ["cj.com", "dpbolvw.net", "jdoqocy.com", "tkqlhce.com", "anrdoezrs.net"]
    },
    "gumroad": {
        "name": "Gumroad",
        "patterns": ["gumroad.com", "gum.co"]
    },
    "clickbank": {
        "name": "ClickBank",
        "patterns": ["clickbank.net", "hop.clickbank.net"]
    },
    "rakuten": {
        "name": "Rakuten",
        "patterns": ["rakuten.com", "linksynergy.com"]
    },
    "awin": {
        "name": "Awin",
        "patterns": ["awin1.com", "zenaps.com"]
    },
    "ltk": {
        "name": "LTK",
        "patterns": ["liketoknow.it", "rewardstyle.com", "shopltk.com", "rstyle.me"]
    },
    "shopmy": {
        "name": "ShopMy",
        "patterns": ["shopmy.us"]
    },
    "magiclinks": {
        "name": "MagicLinks",
        "patterns": ["go.magik.ly", "magiclinks.com"]
    },
    "mavely": {
        "name": "Mavely",
        "patterns": ["mavely.co", "mavely.com"]
    },
    "howl": {
        "name": "Howl",
        "patterns": ["howl.me"]
    },
    "collabs": {
        "name": "Collabs",
        "patterns": ["collabs.shop", "glnk.io"]
    },
    "skimlinks": {
        "name": "Skimlinks",
        "patterns": ["skimlinks.com", "skimresources.com", "go.redirectingat.com"]
    },
    "sovrn": {
        "name": "Sovrn VigLink",
        "patterns": ["viglink.com"]
    },
    "partnerize": {
        "name": "Partnerize",
        "patterns": ["prf.hn", "partnerize.com"]
    },
    "flexoffers": {
        "name": "FlexOffers",
        "patterns": ["flexoffers.com"]
    }
}

class QuotaEstimate(BaseModel):
    search_calls: int
    channel_enrichment_calls: int
    playlist_calls: int
    video_calls: int
    video_description_calls: int = 0
    total_units: int
    daily_limit: int = 10000
    percentage_of_daily: float

class ChannelData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel_id: str
    channel_name: str
    channel_url: str
    description: str = ""
    subscriber_count: int = 0
    hidden_subscriber_count: bool = False
    video_count: int = 0
    view_count: int = 0
    avg_views_recent: float = 0
    latest_upload_date: Optional[str] = None
    days_since_upload: Optional[int] = None
    keywords_found_by: List[str] = []
    search_source: str = ""
    topic_tags: List[str] = []
    affiliate_signals: List[str] = []
    public_links: Dict[str, str] = {}
    score_total: int = 0
    score_topic: int = 0
    score_tutorial: int = 0
    score_activity: int = 0
    score_subscriber: int = 0
    score_engagement: int = 0
    score_contactability: int = 0
    notes: str = ""
    recent_videos: List[Dict[str, Any]] = []
    enriched_at: Optional[str] = None
    # New affiliate detection fields
    latest_video_titles: str = ""  # Pipe-separated titles
    affiliate_signals_count: int = 0
    commercial_signals: List[str] = []
    commercial_signals_count: int = 0
    affiliate_score: int = 0
    has_affiliate_language: bool = False
    does_reviews: bool = False
    has_link_in_bio: bool = False
    product_monetization: bool = False
    # Brand / Sponsorship contact signals
    brand_contact_signals: List[str] = []
    brand_contact_signals_count: int = 0
    has_business_email: bool = False
    business_email: str = ""
    # Affiliate platform links
    affiliate_platform_links: Dict[str, List[str]] = {}  # platform_key -> list of URLs
    affiliate_platforms_found: List[str] = []
    affiliate_platforms_count: int = 0
    # Total affiliate URL count across ALL master patterns (named + unnamed networks).
    # Used to render "N aff links" fallback pill when platforms_found is empty.
    affiliate_links_total: int = 0
    # Tool Stack Detection
    tools_section_detected: bool = False
    tools_stack_signal_score: int = 0
    tools_section_phrases: List[str] = []
    # Channel Health Indicators
    upload_consistency: str = ""  # Daily, Very Active, Active, Occasional, Infrequent
    upload_avg_days: Optional[float] = None
    engagement_health: str = ""  # Healthy, Average, Low, Very Low
    engagement_rate: Optional[float] = None
    growth_indicator: str = ""  # Growing, Stable, Declining
    # Geography (from YouTube snippet.country — self-declared, often missing)
    country: str = ""  # ISO 3166-1 alpha-2 code, "" if undeclared
    country_name: str = ""  # Human-readable name for display

class ShortlistItem(BaseModel):
    channel_id: str

class UpdateNotesInput(BaseModel):
    notes: str

class SearchHistoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    keywords: List[str]
    filters: Dict[str, Any]
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_used_at: Optional[str] = None
    results_count: Optional[int] = None

class SaveSearchInput(BaseModel):
    name: str
    keywords: List[str]
    filters: Dict[str, Any]
    results_count: Optional[int] = None

class SaveReportInput(BaseModel):
    name: str
    keywords: List[str]
    filters: Dict[str, Any]
    channels: List[Dict[str, Any]]
    shortlisted_ids: List[str] = []

class SearchReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    keywords: List[str]
    filters: Dict[str, Any]
    channels: List[Dict[str, Any]]
    shortlisted_ids: List[str] = []
    channels_count: int
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== YOUTUBE SERVICE ====================

# Minimal ISO 3166-1 alpha-2 → country name map for display purposes.
# Anything not listed falls back to the raw 2-letter code on the frontend.
COUNTRY_CODE_TO_NAME = {
    "US": "United States", "GB": "United Kingdom", "CA": "Canada", "AU": "Australia",
    "NZ": "New Zealand", "IE": "Ireland", "ZA": "South Africa", "IN": "India",
    "PK": "Pakistan", "PH": "Philippines", "SG": "Singapore", "MY": "Malaysia",
    "HK": "Hong Kong", "JP": "Japan", "KR": "South Korea", "CN": "China",
    "TW": "Taiwan", "TH": "Thailand", "VN": "Vietnam", "ID": "Indonesia",
    "AE": "United Arab Emirates", "SA": "Saudi Arabia", "IL": "Israel", "TR": "Turkey",
    "EG": "Egypt", "NG": "Nigeria", "KE": "Kenya", "GH": "Ghana", "MA": "Morocco",
    "BR": "Brazil", "MX": "Mexico", "AR": "Argentina", "CL": "Chile", "CO": "Colombia",
    "PE": "Peru", "VE": "Venezuela", "UY": "Uruguay", "EC": "Ecuador",
    "DE": "Germany", "FR": "France", "ES": "Spain", "IT": "Italy", "PT": "Portugal",
    "NL": "Netherlands", "BE": "Belgium", "LU": "Luxembourg", "CH": "Switzerland", "AT": "Austria",
    "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland", "IS": "Iceland",
    "PL": "Poland", "CZ": "Czechia", "SK": "Slovakia", "HU": "Hungary", "RO": "Romania",
    "BG": "Bulgaria", "GR": "Greece", "HR": "Croatia", "SI": "Slovenia", "RS": "Serbia",
    "UA": "Ukraine", "RU": "Russia", "BY": "Belarus", "EE": "Estonia", "LV": "Latvia",
    "LT": "Lithuania", "MT": "Malta", "CY": "Cyprus",
}

def country_name_for(code: str) -> str:
    if not code:
        return ""
    return COUNTRY_CODE_TO_NAME.get(code.upper(), code.upper())

def filter_channels_by_country(channels, target_countries, include_unknown, drops=None):
    """Filter a list of enriched channel dicts by ISO country codes.
    Empty target_countries = no filter. include_unknown keeps channels with no country declared.
    If `drops` is provided, dropped channels are appended to it for diagnostic logging."""
    if not target_countries:
        return channels
    targets = {c.upper() for c in target_countries if c}
    out = []
    for ch in channels:
        ch_country = (ch.get("country") or "").upper()
        if not ch_country:
            if include_unknown:
                out.append(ch)
            elif drops is not None:
                drops.append({
                    "channel_id": ch.get("channel_id", ""),
                    "channel_name": ch.get("channel_name", ""),
                    "reason": "country_filter",
                    "stage": "post_enrichment",
                    "detail": "no country declared (excluded by include_unknown=false)",
                })
            continue
        if ch_country in targets:
            out.append(ch)
        elif drops is not None:
            drops.append({
                "channel_id": ch.get("channel_id", ""),
                "channel_name": ch.get("channel_name", ""),
                "reason": "country_filter",
                "stage": "post_enrichment",
                "detail": f"channel country = {ch_country}",
            })
    return out

def get_youtube_service(user=None):
    """Get YouTube service — uses admin API key for admin users, default key for everyone else.

    Also stamps the current asyncio-task ContextVar so that downstream
    _yt_execute() calls can record which key was used for quota tracking.
    """
    if user and user.get("role") == "admin":
        api_key = os.environ.get("YOUTUBE_API_KEY_ADMIN") or os.environ.get("YOUTUBE_API_KEY")
        key_label = "admin"
    else:
        api_key = os.environ.get("YOUTUBE_API_KEY")
        key_label = "regular"
    if not api_key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured on server")
    _current_yt_key_ctx.set(key_label)
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)

# ==================== SCORING ENGINE ====================

# Default keywords (SaaS niche) - kept for backwards compatibility
TOPIC_KEYWORDS = ['automation', 'workflow', 'zapier', 'make', 'n8n', 'no-code', 'nocode', 'ai tools', 'integrations', 'api']
TUTORIAL_KEYWORDS = ['tutorial', 'how to', 'build', 'setup', 'guide', 'learn', 'step by step', 'beginner']
AFFILIATE_SIGNAL_KEYWORDS = ['best tools', 'top tools', 'review', 'vs', 'comparison', 'automation tools', 'ai tools', 'software review']

# Extended affiliate detection keywords (default)
AFFILIATE_LANGUAGE_KEYWORDS = [
    'affiliate', 'referral', 'partner', 'sponsor', 'sponsored',
    'use my link', 'link in description', 'discount code', 'coupon',
    'deal', 'lifetime deal', 'appsumo', 'review', 'comparison', 'vs',
    'best tools', 'top tools', 'my tech stack', 'tools i use'
]

COMMERCIAL_KEYWORDS = [
    'course', 'coaching', 'consulting', 'templates', 'download',
    'training', 'community', 'gumroad', 'udemy', 'etsy', 'academy',
    'masterclass', 'workshop', 'ebook', 'free guide', 'newsletter'
]

REVIEW_KEYWORDS = ['review', 'vs', 'comparison', 'compared', 'honest review', 'full review']
LINK_IN_BIO_KEYWORDS = ['link in description', 'link in bio', 'links below', 'check the link', 'use my link', 'use code']

# Brand / Sponsorship / Business Contact signals
BRAND_CONTACT_KEYWORDS = [
    'business inquiries', 'business enquiry', 'business enquiries',
    'brand inquiries', 'brand enquiry', 'brand enquiries',
    'brand partnership', 'brand partnerships', 'partnership inquiries', 'partnership enquiries',
    'sponsorship', 'sponsorships', 'sponsorship inquiry', 'sponsorship inquiries',
    'sponsorship enquiry', 'sponsorship enquiries', 'sponsored',
    'collaboration', 'collaborations', 'collab', 'collabs',
    'work with me', "let's work together", 'lets work together',
    'contact for partnerships', 'contact for collaborations',
    'for business contact', 'for business inquiries', 'for brand deals',
    'brand deals', 'work together', 'partner with me'
]

# Email regex pattern
EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')

def calculate_topic_score(channel_name: str, description: str, video_titles: List[str], niche_keywords: List[str] = None) -> tuple:
    """Calculate topic relevance score (0-30) and return matched tags"""
    keywords = niche_keywords if niche_keywords else TOPIC_KEYWORDS
    text = f"{channel_name} {description} {' '.join(video_titles)}".lower()
    matched = []
    for keyword in keywords:
        if keyword in text:
            matched.append(keyword)
    score = min(30, len(matched) * 6)
    return score, matched

def calculate_tutorial_score(channel_name: str, description: str, video_titles: List[str]) -> int:
    """Calculate tutorial intent score (0-20)"""
    text = f"{channel_name} {description} {' '.join(video_titles)}".lower()
    count = sum(1 for keyword in TUTORIAL_KEYWORDS if keyword in text)
    return min(20, count * 5)

def calculate_activity_score(days_since_upload: Optional[int]) -> int:
    """Calculate activity score (0-15)"""
    if days_since_upload is None:
        return 0
    if days_since_upload < 30:
        return 15
    elif days_since_upload < 60:
        return 10
    elif days_since_upload < 90:
        return 5
    return 0

def calculate_subscriber_score(subscriber_count: int, hidden: bool) -> int:
    """Calculate subscriber sweet spot score (0-15)"""
    if hidden:
        return 5  # Give partial score for hidden
    if 2000 <= subscriber_count <= 50000:
        return 15
    elif 50000 < subscriber_count <= 150000:
        return 10
    elif subscriber_count > 150000:
        return 5
    return 0

def calculate_engagement_score(avg_views: float, subscriber_count: int) -> int:
    """Calculate engagement score (0-10)"""
    if subscriber_count == 0:
        return 0
    ratio = avg_views / subscriber_count
    if ratio >= 0.3:
        return 10
    elif ratio >= 0.2:
        return 8
    elif ratio >= 0.1:
        return 6
    elif ratio >= 0.05:
        return 4
    return 2

def calculate_contactability_score(public_links: Dict[str, str]) -> int:
    """Calculate contactability score (0-10)"""
    score = 0
    if public_links.get('website'):
        score += 3
    if public_links.get('linkedin'):
        score += 3
    if public_links.get('twitter') or public_links.get('x'):
        score += 2
    if public_links.get('instagram'):
        score += 2
    return min(10, score)

def calculate_upload_consistency(recent_videos: list) -> tuple:
    """Calculate upload consistency from recent video dates."""
    if len(recent_videos) < 2:
        return ("Infrequent", None)
    dates = []
    for v in recent_videos:
        pa = v.get("published_at")
        if pa:
            try:
                dates.append(datetime.fromisoformat(pa.replace("Z", "+00:00")))
            except Exception:
                pass
    if len(dates) < 2:
        return ("Infrequent", None)
    dates.sort(reverse=True)
    gaps = [(dates[i] - dates[i + 1]).days for i in range(len(dates) - 1)]
    avg_days = sum(gaps) / len(gaps) if gaps else 999
    if avg_days <= 2:
        return ("Daily", round(avg_days, 1))
    elif avg_days <= 7:
        return ("Very Active", round(avg_days, 1))
    elif avg_days <= 14:
        return ("Active", round(avg_days, 1))
    elif avg_days <= 30:
        return ("Occasional", round(avg_days, 1))
    return ("Infrequent", round(avg_days, 1))

def calculate_engagement_health(avg_views: float, subscriber_count: int) -> tuple:
    """Calculate engagement health flag."""
    if subscriber_count == 0:
        return ("Average", 0.0)
    rate = (avg_views / subscriber_count) * 100
    rate = round(rate, 2)
    if rate >= 5:
        return ("Healthy", rate)
    elif rate >= 2:
        return ("Average", rate)
    elif rate >= 0.5:
        return ("Low", rate)
    return ("Very Low", rate)

def calculate_growth_indicator(avg_views_recent: float, view_count: int, video_count: int) -> str:
    """Calculate growth indicator by comparing recent performance to lifetime average."""
    if video_count == 0 or view_count == 0:
        return "Stable"
    lifetime_avg = view_count / video_count
    if lifetime_avg == 0:
        return "Stable"
    ratio = avg_views_recent / lifetime_avg
    if ratio > 1.5:
        return "Growing"
    elif ratio < 0.5:
        return "Declining"
    return "Stable"

def detect_affiliate_signals(channel_name: str, description: str, video_titles: List[str], niche_keywords: List[str] = None) -> List[str]:
    """Detect affiliate likelihood signals"""
    keywords = niche_keywords if niche_keywords else AFFILIATE_SIGNAL_KEYWORDS
    text = f"{channel_name} {description} {' '.join(video_titles)}".lower()
    signals = []
    for keyword in keywords:
        if keyword in text:
            signals.append(keyword)
    return signals

def detect_affiliate_language(description: str, video_titles: List[str], notes: str = "", niche_keywords: List[str] = None) -> tuple:
    """
    Detect affiliate/review intent keywords.
    Returns: (matched_keywords, count, has_affiliate_language, does_reviews, has_link_in_bio)
    """
    keywords = niche_keywords if niche_keywords else AFFILIATE_LANGUAGE_KEYWORDS
    text = f"{description} {' '.join(video_titles)} {notes}".lower()
    matched = []
    
    for keyword in keywords:
        if keyword in text:
            matched.append(keyword)
    
    # Check boolean flags
    has_affiliate = any(kw in text for kw in ['affiliate', 'referral', 'partner', 'sponsor', 'discount code', 'coupon', 'appsumo'])
    does_reviews = any(kw in text for kw in REVIEW_KEYWORDS)
    has_link_in_bio = any(kw in text for kw in LINK_IN_BIO_KEYWORDS)
    
    return matched, len(matched), has_affiliate, does_reviews, has_link_in_bio

def detect_commercial_signals(description: str, notes: str = "", niche_keywords: List[str] = None) -> tuple:
    """
    Detect commercial/product signals.
    Returns: (matched_keywords, count, product_monetization)
    """
    keywords = niche_keywords if niche_keywords else COMMERCIAL_KEYWORDS
    text = f"{description} {notes}".lower()
    matched = []
    
    for keyword in keywords:
        if keyword in text:
            matched.append(keyword)
    
    product_monetization = len(matched) >= 2  # Has multiple commercial signals
    
    return matched, len(matched), product_monetization

def detect_brand_contact_signals(description: str) -> tuple:
    """
    Detect brand/sponsorship/business contact signals.
    Returns: (matched_keywords, count)
    """
    text = description.lower()
    matched = []
    
    for keyword in BRAND_CONTACT_KEYWORDS:
        if keyword in text:
            matched.append(keyword)
    
    return matched, len(matched)

def detect_business_email(description: str) -> tuple:
    """
    Detect business email in description.
    Returns: (has_email, email_address)
    """
    match = EMAIL_PATTERN.search(description)
    if match:
        email = match.group(0)
        # Filter out common non-business emails
        skip_domains = ['example.com', 'email.com', 'mail.com', 'test.com']
        if not any(domain in email.lower() for domain in skip_domains):
            return True, email
    return False, ""

def detect_affiliate_platform_links(text: str, platforms_to_detect: List[str]) -> tuple:
    """
    Detect affiliate platform links in text.
    Returns: (platform_links dict, platforms_found list, count)
    """
    platform_links = {}
    platforms_found = []
    
    for platform_key in platforms_to_detect:
        if platform_key not in AFFILIATE_PLATFORMS:
            continue
        
        platform_info = AFFILIATE_PLATFORMS[platform_key]
        found_urls = []
        
        for pattern in platform_info["patterns"]:
            # Create regex pattern for URL matching
            escaped_pattern = re.escape(pattern).replace(r"\.\*", ".*")
            url_regex = rf'https?://(?:www\.)?{escaped_pattern}[^\s<>"\')]*'
            url_pattern = re.compile(url_regex, re.IGNORECASE)
            matches = url_pattern.findall(text)
            found_urls.extend(matches)
        
        if found_urls:
            platform_links[platform_key] = list(set(found_urls))  # Dedupe
            platforms_found.append(platform_key)
    
    return platform_links, platforms_found, len(platforms_found)

TOOLS_SECTION_PHRASES = [
    "tools i use", "my tools", "my tech stack", "tools i recommend",
    "recommended tools", "resources mentioned", "resources i use",
    "my favorite tools", "my favourite tools", "software i use",
    "my software stack", "tools mentioned", "links mentioned",
    "products i use", "apps i use", "gear i use",
]

def detect_tools_section(channel_description: str, video_descriptions: str) -> tuple:
    """
    Detect 'Tools I Use' / 'Resources' sections in descriptions.
    Returns: (detected: bool, score: int, matched_phrases: list)
    """
    matched = set()
    in_video = False
    in_channel = False

    for phrase in TOOLS_SECTION_PHRASES:
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        if pattern.search(channel_description):
            matched.add(phrase)
            in_channel = True
        if pattern.search(video_descriptions):
            matched.add(phrase)
            in_video = True

    if not matched:
        return False, 0, []

    score = 0
    if in_video:
        score += 20
    if in_channel:
        score += 10
    if len(matched) >= 2:
        score += 10
    score = min(score, 30)

    return True, score, sorted(matched)

# Non-Latin character ranges for language detection
_NON_LATIN_RE = re.compile(
    r'[\u0400-\u04FF]'   # Cyrillic
    r'|[\u0600-\u06FF]'  # Arabic
    r'|[\u0E00-\u0E7F]'  # Thai
    r'|[\u3040-\u309F]'  # Hiragana
    r'|[\u30A0-\u30FF]'  # Katakana
    r'|[\u4E00-\u9FFF]'  # CJK Unified
    r'|[\uAC00-\uD7AF]'  # Korean Hangul
    r'|[\u0900-\u097F]'  # Devanagari (Hindi)
    r'|[\u0980-\u09FF]'  # Bengali
    r'|[\u0A80-\u0AFF]'  # Gujarati
    r'|[\u0B80-\u0BFF]'  # Tamil
    r'|[\u0C00-\u0C7F]'  # Telugu
)

def is_likely_english(video_titles: list, channel_title: str = "", description: str = "") -> bool:
    """
    Check if a channel's content is likely English by analyzing video titles.
    Returns True if the content appears to be English, False otherwise.
    """
    if not video_titles:
        return True  # No titles to check, give benefit of the doubt
    
    # Combine all titles into one text block
    combined = " ".join(video_titles)
    if not combined.strip():
        return True
    
    # Count non-Latin characters vs total alphabetic characters
    non_latin_chars = len(_NON_LATIN_RE.findall(combined))
    total_chars = len(combined.replace(" ", ""))
    
    if total_chars == 0:
        return True
    
    # If more than 30% of characters are non-Latin, it's likely non-English
    non_latin_ratio = non_latin_chars / total_chars
    if non_latin_ratio > 0.3:
        return False
    
    return True



def calculate_affiliate_score(score_topic: int, score_tutorial: int, affiliate_signals_count: int, 
                              commercial_signals_count: int, score_engagement: int,
                              brand_contact_signals_count: int = 0, has_business_email: bool = False,
                              tools_stack_signal_score: int = 0) -> int:
    """
    Calculate affiliate potential score (0-100).
    Updated weighted formula:
    - 15% topic relevance (normalized from 0-30 to 0-15)
    - 10% tutorial intent (normalized from 0-20 to 0-10)
    - 20% affiliate signals (normalized, max at 5+ signals = 20)
    - 15% commercial signals (normalized, max at 4+ signals = 15)
    - 10% brand contact signals (normalized, max at 3+ signals = 10)
    - 10% engagement (already 0-10)
    - 10% tools stack (normalized from 0-30 to 0-10)
    + 10 bonus for has_business_email
    """
    topic_component = (score_topic / 30) * 15
    tutorial_component = (score_tutorial / 20) * 10
    affiliate_component = min(20, affiliate_signals_count * 4)
    commercial_component = min(15, commercial_signals_count * 3.75)
    brand_contact_component = min(10, brand_contact_signals_count * 3.33)
    engagement_component = score_engagement
    tools_component = (tools_stack_signal_score / 30) * 10
    email_bonus = 10 if has_business_email else 0
    
    total = (topic_component + tutorial_component + affiliate_component + 
             commercial_component + brand_contact_component + engagement_component + 
             tools_component + email_bonus)
    
    return min(100, int(round(total)))

def extract_public_links(description: str, branding_links: List[Dict] = None) -> Dict[str, str]:
    """Extract public contact links from description and branding settings"""
    links = {}
    
    # Common URL patterns
    patterns = {
        'twitter': r'(?:twitter\.com|x\.com)/([^\s\)]+)',
        'linkedin': r'linkedin\.com/in/([^\s\)]+)',
        'instagram': r'instagram\.com/([^\s\)]+)',
        'website': r'https?://(?!(?:twitter|x|linkedin|instagram|youtube|facebook)\.com)([^\s\)]+\.[^\s\)]+)',
    }
    
    text = description.lower()
    
    for platform, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if platform == 'website':
                links[platform] = match.group(0)
            else:
                links[platform] = f"https://{platform}.com/{match.group(1)}" if platform != 'twitter' else f"https://x.com/{match.group(1)}"
    
    # Process branding settings links
    if branding_links:
        for link in branding_links:
            url = link.get('url', '').lower()
            if 'twitter.com' in url or 'x.com' in url:
                links['twitter'] = link.get('url')
            elif 'linkedin.com' in url:
                links['linkedin'] = link.get('url')
            elif 'instagram.com' in url:
                links['instagram'] = link.get('url')
            elif not links.get('website') and 'youtube.com' not in url and 'facebook.com' not in url:
                links['website'] = link.get('url')
    
    return links

# ==================== AUTH HELPERS ====================

def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check access expiry — auto-downgrade to free if expired
        expires_at = user.get("access_expires_at")
        if expires_at and user.get("tier") not in ("free",):
            try:
                expiry_dt = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
                if datetime.now(timezone.utc) > expiry_dt:
                    update_fields = {"tier": "free", "access_expired": True}
                    if user.get("is_trial"):
                        update_fields["trial_expired"] = True
                        update_fields["is_trial"] = False
                    await db.users.update_one(
                        {"id": user_id},
                        {"$set": update_fields, "$unset": {"access_expires_at": ""}}
                    )
                    user["tier"] = "free"
                    user["access_expired"] = True
                    if user.get("is_trial"):
                        user["trial_expired"] = True
            except Exception:
                pass
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(data: AuthRegister):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    hashed_password = await _hash_password(data.password)
    user = {
        "id": user_id,
        "email": data.email.lower(),
        "password_hash": hashed_password,
        "role": "user",
        "tier": "free",
        "monthly_search_count": 0,
        "search_count_reset_date": datetime.now(timezone.utc).strftime("%Y-%m"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Handle 14-day trial signup
    if data.trial == "starter_14":
        user["tier"] = "starter"
        user["is_trial"] = True
        user["trial_started_at"] = datetime.now(timezone.utc).isoformat()
        user["access_expires_at"] = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    
    await db.users.insert_one(user)
    token = create_token(user_id, data.email.lower())
    return {
        "token": token, 
        "user": {
            "id": user_id, 
            "email": data.email.lower(), 
            "role": "user", 
            "tier": user["tier"],
            "is_trial": user.get("is_trial", False),
            "has_paid": False
        }
    }

@api_router.post("/auth/login")
async def login(data: AuthLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not await _verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    tier = user.get("tier", "free")
    # Backwards compatibility: has_paid = true if tier is pro or appsumo
    has_paid = tier in ["pro", "appsumo"]
    return {
        "token": token, 
        "user": {
            "id": user["id"], 
            "email": user["email"], 
            "role": user.get("role", "user"), 
            "tier": tier,
            "has_paid": has_paid
        }
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    tier = user.get("tier", "free")
    user["tier"] = tier
    user["has_paid"] = tier in ["pro", "appsumo"]  # Backwards compatibility
    return user

@api_router.post("/auth/request-password-reset")
async def request_password_reset(data: PasswordResetRequest):
    """Send a password reset email with a 6-digit code"""
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        # Don't reveal whether email exists
        return {"success": True, "message": "If that email is registered, a reset code has been sent."}

    # Generate 6-digit reset code
    import random
    reset_code = f"{random.randint(100000, 999999)}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()

    await db.password_resets.delete_many({"email": data.email.lower()})
    await db.password_resets.insert_one({
        "email": data.email.lower(),
        "code": reset_code,
        "expires_at": expires_at,
        "used": False,
    })

    # Send email
    try:
        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = int(os.environ.get("SMTP_PORT", 587))
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = data.email.lower()
        msg["Subject"] = "Affilitube — Password Reset Code"

        body = f"""Hi,

You requested a password reset for your Affilitube account.

Your reset code is: {reset_code}

This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.

— Affilitube"""
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
        # Code is stored in DB - return success so user doesn't know if email exists

    return {"success": True, "message": "If that email is registered, a reset code has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(data: PasswordResetConfirm):
    """Reset password using the 6-digit code"""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    record = await db.password_resets.find_one({"code": data.token, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    # Update password
    new_hash = await _hash_password(data.new_password)
    await db.users.update_one({"email": record["email"]}, {"$set": {"password_hash": new_hash}})

    # Mark code as used
    await db.password_resets.update_one({"code": data.token}, {"$set": {"used": True}})

    return {"success": True, "message": "Password reset successfully. You can now log in."}

# ==================== API ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Affilitube API"}

# Bug report endpoint
def send_bug_report_email(user_email: str, subject: str, description: str, steps: str, severity: str):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    to_email = os.environ.get("BUG_REPORT_EMAIL")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg["Subject"] = f"[Affilitube Bug] [{severity.upper()}] {subject}"

    body = f"""Bug Report from Affilitube Dashboard

Reported by: {user_email}
Severity: {severity}
Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

--- Description ---
{description}

--- Steps to Reproduce ---
{steps if steps else 'Not provided'}
"""
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

@api_router.post("/bug-report")
async def submit_bug_report(report: BugReportInput, user=Depends(get_current_user)):
    """Submit a bug report — sends email to admin"""
    try:
        send_bug_report_email(
            user_email=user["email"],
            subject=report.subject,
            description=report.description,
            steps=report.steps_to_reproduce,
            severity=report.severity,
        )
    except Exception as e:
        logger.error(f"Failed to send bug report email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send bug report. Please try again.")

    # Also store in DB for reference
    await db.bug_reports.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "subject": report.subject,
        "description": report.description,
        "steps_to_reproduce": report.steps_to_reproduce,
        "severity": report.severity,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "message": "Bug report submitted. Thank you!"}

# Partner program application endpoint
PARTNER_PROGRAM_EMAIL = "adrian@affilitube.com"

def send_partner_application_email(full_name: str, email: str, experience: str):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")

    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = PARTNER_PROGRAM_EMAIL
    msg["Reply-To"] = email
    msg["Subject"] = f"[Partner Program] New application from {full_name}"

    body = f"""New AffiliTube Partner Program Application

Name: {full_name}
Email: {email}
Submitted: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}

--- Promotion experience / about ---
{experience if experience.strip() else 'Not provided'}
"""
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

def send_partner_application_autoreply(full_name: str, email: str):
    """Send an auto-reply to the applicant confirming receipt of their application."""
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")

    first_name = full_name.strip().split()[0] if full_name.strip() else "there"

    msg = MIMEMultipart()
    msg["From"] = f"Adrian at AffiliTube <{smtp_user}>"
    msg["To"] = email
    msg["Reply-To"] = PARTNER_PROGRAM_EMAIL
    msg["Subject"] = "Your AffiliTube Partner Program application — we've got it"

    body = f"""Hi {first_name},

Thanks for applying to the AffiliTube Partner Program — your application is in front of me now.

I read every application personally, so you'll hear back from me directly (not a templated reply) within 1–2 business days. If we're a good fit, I'll send over your tracking link, access to the creative library, and anything else you need to start promoting.

A couple of things worth knowing while you wait:

  • Commissions start at 30% recurring on every Starter ($39.99/mo) and Pro ($79/mo) subscription you refer, and unlock to 40% lifetime for star partners after 12 months.
  • Cookie window is 90 days, so even slow-to-convert audiences still earn you commission.
  • If you're newer to affiliate marketing, that's completely fine — we help with positioning, keyword angles, and custom assets when it'll move the needle for your audience.

If anything has changed since you applied (a new project, a new angle, a piece of content you'd like me to look at), just hit reply — this address routes straight to me.

Talk soon,

Adrian
Founder, AffiliTube
https://affilitube.com
"""
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)

@api_router.post("/partner-program/apply")
async def submit_partner_application(application: PartnerApplicationInput):
    """Submit a Partner Program application. Emails the application to the program inbox."""
    name = (application.full_name or "").strip()
    email = (application.email or "").strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not email or not EMAIL_PATTERN.fullmatch(email):
        raise HTTPException(status_code=400, detail="A valid email address is required")

    try:
        send_partner_application_email(
            full_name=name,
            email=email,
            experience=application.promotion_experience or "",
        )
    except Exception as e:
        logger.error(f"Failed to send partner application email: {e}")
        raise HTTPException(status_code=500, detail="Could not submit your application. Please try again.")

    # Best-effort auto-reply to the applicant — never block the request
    try:
        send_partner_application_autoreply(full_name=name, email=email)
    except Exception as e:
        logger.error(f"Failed to send partner application auto-reply to {email}: {e}")

    # Persist a copy for reference
    await db.partner_applications.insert_one({
        "id": str(uuid.uuid4()),
        "full_name": name,
        "email": email,
        "promotion_experience": application.promotion_experience or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "message": "Application received. We'll be in touch within 1–2 business days."}

# Niche endpoints
@api_router.get("/niches")
async def get_niches():
    """Get all available niches with their configurations"""
    niches = []
    for key, config in NICHE_CONFIGS.items():
        niches.append({
            "key": key,
            "name": config["name"],
            "icon": config["icon"],
            "description": config["description"],
            "placeholder_examples": config["placeholder_examples"]
        })
    return {"niches": niches}

# User tier/usage endpoint
@api_router.get("/user/usage")
async def get_user_usage(user=Depends(get_current_user)):
    """Get user's tier and usage information"""
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    search_limit_info = await check_search_limit(user)
    
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    
    trial_days_remaining = None
    if user.get("is_trial") and user.get("access_expires_at"):
        try:
            exp = datetime.fromisoformat(user["access_expires_at"]) if isinstance(user["access_expires_at"], str) else user["access_expires_at"]
            remaining = (exp - datetime.now(timezone.utc)).days
            trial_days_remaining = max(0, remaining)
        except Exception:
            pass
    
    return {
        "tier": tier,
        "tier_name": tier_config["name"],
        "searches_used": search_limit_info.get("searches_used", 0),
        "searches_remaining": search_limit_info.get("searches_remaining"),
        "max_searches": search_limit_info.get("max_searches"),
        "max_results_per_search": tier_config["max_results_per_search"],
        "csv_export": tier_config["csv_export"] and not user.get("is_trial", False),
        "saved_searches": tier_config["saved_searches"],
        "saved_reports": tier_config["saved_reports"],
        "pipeline_access": tier_config.get("pipeline_access", False),
        "max_pipeline_projects": tier_config.get("max_pipeline_projects"),
        "is_unlimited": tier_config["searches_per_month"] is None or user.get("role") == "admin",
        "draft_credits": user_data.get("draft_credits", 0) if user_data else 0,
        "has_outreach_config": bool(user_data.get("outreach_config", {}).get("product_name")) if user_data else False,
        "access_expired": user.get("access_expired", False),
        "search_warning": search_limit_info.get("warning"),
        "is_trial": user.get("is_trial", False),
        "trial_expired": user.get("trial_expired", False),
        "trial_days_remaining": trial_days_remaining,
    }

# Quota estimation endpoint
@api_router.post("/quota/estimate", response_model=QuotaEstimate)
async def estimate_quota(filters: SearchFilters, user=Depends(get_current_user)):
    """Estimate API quota usage before running search"""
    num_keywords = len(filters.keywords)
    
    # Search calls (100 units each)
    search_calls = 0
    if filters.search_mode in ["channels_only", "channels_videos"]:
        search_calls += num_keywords  # Channel searches
    if filters.search_mode in ["videos_only", "channels_videos"]:
        search_calls += num_keywords  # Video searches
    
    # Estimate unique channels (conservative: ~30 per keyword after dedup)
    estimated_channels = min(num_keywords * 30, 200)
    
    # Apply max_channels_to_enrich limit if set
    if filters.max_channels_to_enrich:
        estimated_channels = min(estimated_channels, filters.max_channels_to_enrich)
    
    # Channel enrichment (1 unit per 50 channels batch)
    channel_enrichment_calls = (estimated_channels + 49) // 50
    
    # Playlist calls for activity analysis (1 unit each)
    playlist_calls = estimated_channels
    
    # Video detail calls for engagement (1 unit per 50 videos batch)
    videos_per_channel = min(filters.videos_to_scan, 20)
    total_videos = estimated_channels * videos_per_channel
    video_calls = (total_videos + 49) // 50
    
    # Video description calls (only if scan_video_descriptions is enabled)
    video_description_calls = 0
    if filters.scan_video_descriptions:
        video_description_calls = video_calls  # Same as video stats calls
    
    total = (search_calls * 100) + channel_enrichment_calls + playlist_calls + video_calls + video_description_calls
    
    return QuotaEstimate(
        search_calls=search_calls,
        channel_enrichment_calls=channel_enrichment_calls,
        playlist_calls=playlist_calls,
        video_calls=video_calls,
        video_description_calls=video_description_calls,
        total_units=total,
        daily_limit=10000,
        percentage_of_daily=round((total / 10000) * 100, 1)
    )

# Get available affiliate platforms
@api_router.get("/affiliate-platforms")
async def get_affiliate_platforms():
    """Get list of available affiliate platforms for detection"""
    platforms = []
    for key, info in AFFILIATE_PLATFORMS.items():
        platforms.append({
            "key": key,
            "name": info["name"],
            "patterns": info["patterns"]
        })
    return {"platforms": platforms}

# Quota usage endpoints
@api_router.get("/quota/usage")
async def get_quota_usage_endpoint(user=Depends(get_current_user)):
    """Get current quota usage for today"""
    usage = await get_quota_usage(user["id"])
    reset_info = get_quota_reset_time()
    return {
        **usage,
        "daily_limit": 10000,
        "percentage_used": round((usage.get("total_units", 0) / 10000) * 100, 1),
        "reset_info": reset_info
    }

@api_router.post("/quota/reset")
async def reset_quota_tracking(user=Depends(get_current_user)):
    """Manually reset quota tracking (for testing)"""
    today = await get_today_pacific()
    await db.quota_usage.delete_one({"date": today, "user_id": user["id"]})
    return {"success": True, "message": "Quota tracking reset for today"}

# Main search endpoint
@api_router.post("/search")
async def search_channels(filters: SearchFilters, user=Depends(get_current_user)):
    """Search for YouTube channels based on keywords"""
    # Check tier-based search limits
    search_limit = await check_search_limit(user)
    if not search_limit["can_search"]:
        if search_limit.get("tier") == "pro":
            raise HTTPException(
                status_code=403,
                detail="You've reached your monthly search limit. Contact us to discuss a higher quota for your account."
            )
        tier_config = get_tier_config(search_limit["tier"])
        raise HTTPException(
            status_code=403, 
            detail=f"Monthly search limit reached ({tier_config['searches_per_month']} searches). Upgrade your plan for more searches."
        )
    
    # Get YouTube service with backend API key
    try:
        youtube = get_youtube_service(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube service error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize YouTube service")
    
    # Track channels with their sources
    channels_map = {}  # channel_id -> {keywords: [], sources: set()}
    
    try:
        for keyword in filters.keywords:
            keyword = keyword.strip()
            if not keyword:
                continue
            
            # Channel search
            if filters.search_mode in ["channels_only", "channels_videos"]:
                try:
                    response = await _yt_execute(youtube.search().list(
                        part="snippet",
                        q=keyword,
                        type="channel",
                        maxResults=min(filters.max_results_per_keyword, 50),
                        relevanceLanguage="en"
                    ))
                    
                    # Track API call
                    await track_api_call("search", 1, user["id"])
                    
                    for item in response.get("items", []):
                        ch_id = item["id"]["channelId"]
                        if ch_id not in channels_map:
                            channels_map[ch_id] = {"keywords": [], "sources": set(), "title": item["snippet"].get("channelTitle", "")}
                        channels_map[ch_id]["keywords"].append(keyword)
                        channels_map[ch_id]["sources"].add("channel_search")
                except HttpError as e:
                    logger.error(f"Channel search error for '{keyword}': {e}")
                    if "quotaExceeded" in str(e):
                        await mark_quota_exceeded(user["id"])
                        reset_info = get_quota_reset_time()
                        raise HTTPException(
                            status_code=429, 
                            detail=f"YouTube API daily quota exceeded. Resets in {reset_info['hours']}h {reset_info['minutes']}m at midnight Pacific Time."
                        )
            
            # Video search
            if filters.search_mode in ["videos_only", "channels_videos"]:
                try:
                    response = await _yt_execute(youtube.search().list(
                        part="snippet",
                        q=keyword,
                        type="video",
                        maxResults=min(filters.max_results_per_keyword, 50),
                        publishedAfter=(datetime.now(timezone.utc) - timedelta(days=filters.uploaded_within_days)).isoformat(),
                        relevanceLanguage="en"
                    ))
                    
                    # Track API call
                    await track_api_call("search", 1, user["id"])
                    
                    for item in response.get("items", []):
                        ch_id = item["snippet"]["channelId"]
                        if ch_id not in channels_map:
                            channels_map[ch_id] = {"keywords": [], "sources": set(), "title": item["snippet"].get("channelTitle", "")}
                        if keyword not in channels_map[ch_id]["keywords"]:
                            channels_map[ch_id]["keywords"].append(keyword)
                        channels_map[ch_id]["sources"].add("video_search")
                except HttpError as e:
                    logger.error(f"Video search error for '{keyword}': {e}")
                    if "quotaExceeded" in str(e):
                        await mark_quota_exceeded(user["id"])
                        reset_info = get_quota_reset_time()
                        raise HTTPException(
                            status_code=429, 
                            detail=f"YouTube API daily quota exceeded. Resets in {reset_info['hours']}h {reset_info['minutes']}m at midnight Pacific Time."
                        )
        
        # Apply free tier result limit
        tier = get_user_tier(user)
        tier_config = get_tier_config(tier)
        channel_ids = list(channels_map.keys())
        
        # Track drops for diagnostic panel (admin only on the frontend)
        drops = []

        # Remove user-excluded channels
        excluded = await db.excluded_channels.find(
            {"user_id": user["id"]}, {"_id": 0, "channel_id": 1}
        ).to_list(length=10000)
        excluded_ids = {e["channel_id"] for e in excluded}
        if excluded_ids:
            kept = []
            for cid in channel_ids:
                if cid in excluded_ids:
                    drops.append({
                        "channel_id": cid,
                        "channel_name": channels_map[cid].get("title", ""),
                        "reason": "excluded_list",
                        "stage": "pre_enrichment",
                    })
                else:
                    kept.append(cid)
            channel_ids = kept
        
        # Filter by exclude keywords (match against channel title from search snippets)
        if filters.exclude_keywords:
            exclude_lower = [ek.strip().lower() for ek in filters.exclude_keywords if ek.strip()]
            if exclude_lower:
                filtered_ids = []
                for ch_id in channel_ids:
                    ch_title = channels_map[ch_id].get("title", "").lower()
                    matched = next((ek for ek in exclude_lower if ek in ch_title), None)
                    if matched:
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": channels_map[ch_id].get("title", ""),
                            "reason": "exclude_keyword",
                            "stage": "pre_enrichment",
                            "detail": f"matched '{matched}'",
                        })
                    else:
                        filtered_ids.append(ch_id)
                channel_ids = filtered_ids
        
        if tier_config["max_results_per_search"] is not None:
            limit = tier_config["max_results_per_search"]
            if len(channel_ids) > limit:
                for cid in channel_ids[limit:]:
                    drops.append({
                        "channel_id": cid,
                        "channel_name": channels_map[cid].get("title", ""),
                        "reason": "tier_max_results_cap",
                        "stage": "pre_enrichment",
                        "detail": f"tier cap = {limit}",
                    })
                channel_ids = channel_ids[:limit]
        
        # Determine search source for each channel
        channel_metadata = {}
        for ch_id in channel_ids:
            data = channels_map[ch_id]
            sources = data["sources"]
            if "channel_search" in sources and "video_search" in sources:
                source = "both"
            elif "channel_search" in sources:
                source = "channel_search"
            else:
                source = "video_search"
            channel_metadata[ch_id] = {
                "keywords_found_by": list(set(data["keywords"])),
                "search_source": source
            }
        
        # Increment search count for free tier users
        await increment_search_count(user["id"])
        
        # Log search activity for admin panel
        await db.search_activity.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "user_email": user["email"],
            "niche": filters.niche,
            "keywords": [k.strip() for k in filters.keywords if k.strip()],
            "results_count": len(channel_ids),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        
        return {
            "channel_ids": channel_ids,
            "channel_metadata": channel_metadata,
            "total_found": len(channel_ids),
            "total_before_limit": len(channels_map),
            "niche": filters.niche,
            "drops": drops,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Channel enrichment endpoint
@api_router.post("/channels/enrich")
async def enrich_channels(req: EnrichRequest, user=Depends(get_current_user)):
    """Enrich channels with statistics and scoring"""
    # Get YouTube service with backend API key
    try:
        youtube = get_youtube_service(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"YouTube service error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initialize YouTube service")
    
    # Get niche-specific keywords
    niche_config = get_niche_config(req.niche)
    niche_topic_keywords = niche_config["topic_keywords"]
    niche_affiliate_signal_keywords = niche_config["affiliate_signal_keywords"]
    niche_affiliate_language_keywords = niche_config["affiliate_language_keywords"]
    niche_commercial_keywords = niche_config["commercial_keywords"]
    
    channel_ids = req.channel_ids
    channel_metadata = req.channel_metadata
    min_subscribers = req.min_subscribers
    max_subscribers = req.max_subscribers
    videos_to_scan = req.videos_to_scan
    scan_video_descriptions = req.scan_video_descriptions
    max_channels_to_enrich = req.max_channels_to_enrich
    affiliate_platforms = req.affiliate_platforms
    
    # Remove user-excluded channels before enrichment
    excluded = await db.excluded_channels.find(
        {"user_id": user["id"]}, {"_id": 0, "channel_id": 1}
    ).to_list(length=10000)
    excluded_ids = {e["channel_id"] for e in excluded}
    if excluded_ids:
        channel_ids = [cid for cid in channel_ids if cid not in excluded_ids]
    
    # Remove channels already in pipeline if toggle is on
    if req.hide_pipeline_channels:
        pipeline_channels = await db.channels.find(
            {"user_id": user["id"], "$or": [
                {"outreach_status": {"$exists": True, "$ne": "not_contacted"}},
                {"project_name": {"$exists": True, "$nin": [None, ""]}}
            ]},
            {"_id": 0, "channel_id": 1}
        ).to_list(length=10000)
        pipeline_ids = {ch["channel_id"] for ch in pipeline_channels}
        if pipeline_ids:
            channel_ids = [cid for cid in channel_ids if cid not in pipeline_ids]
            logger.info(f"Hidden {len(pipeline_ids)} pipeline channels from results")
    
    # Apply max channels limit
    if max_channels_to_enrich and len(channel_ids) > max_channels_to_enrich:
        channel_ids = channel_ids[:max_channels_to_enrich]
    
    # Check cache first — use cached data for channels enriched within 24 hours
    cached_channels = []
    uncached_ids = []
    cache_cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    
    for ch_id in channel_ids:
        cached = await db.channels.find_one(
            {"channel_id": ch_id, "user_id": user["id"], "enriched_at": {"$gte": cache_cutoff}},
            {"_id": 0, "user_id": 0}
        )
        if cached:
            # Re-check subscriber filters on cached data
            sub_count = cached.get("subscriber_count", 0)
            hidden = cached.get("hidden_subscriber_count", False)
            if not hidden and (sub_count < min_subscribers or sub_count > max_subscribers):
                continue
            # Backfill health indicators if missing
            if not cached.get("upload_consistency"):
                uc, uad = calculate_upload_consistency(cached.get("recent_videos", []))
                eh, er = calculate_engagement_health(cached.get("avg_views_recent", 0), cached.get("subscriber_count", 0))
                gi = calculate_growth_indicator(cached.get("avg_views_recent", 0), cached.get("view_count", 0), cached.get("video_count", 0))
                cached["upload_consistency"] = uc
                cached["upload_avg_days"] = uad
                cached["engagement_health"] = eh
                cached["engagement_rate"] = er
                cached["growth_indicator"] = gi
            cached_channels.append(cached)
        else:
            uncached_ids.append(ch_id)
    
    if uncached_ids:
        logger.info(f"Cache hit: {len(cached_channels)}, fetching: {len(uncached_ids)}")
    else:
        logger.info(f"Full cache hit: {len(cached_channels)} channels")
    
    enriched_channels = list(cached_channels)
    channel_ids = uncached_ids  # Only fetch uncached channels
    
    # Drop log — every channel rejected at any filter stage gets recorded here
    drops = []
    
    if not channel_ids:
        enriched_channels.sort(key=lambda x: x.get("score_total", 0), reverse=True)
        enriched_channels = filter_channels_by_country(enriched_channels, req.target_countries, req.include_unknown_country, drops)
        return {"channels": enriched_channels, "total": len(enriched_channels), "cached": len(cached_channels), "drops": drops}
    
    videos_to_fetch = min(videos_to_scan, 20)  # Cap at 20
    
    try:
        # Batch fetch channel details (50 at a time)
        for i in range(0, len(channel_ids), 50):
            batch = channel_ids[i:i+50]
            
            try:
                response = await _yt_execute(youtube.channels().list(
                    part="snippet,statistics,brandingSettings,contentDetails",
                    id=",".join(batch)
                ))
                
                # Track API call
                await track_api_call("channels", 1, user["id"])
                
                for item in response.get("items", []):
                    ch_id = item["id"]
                    stats = item.get("statistics", {})
                    snippet = item.get("snippet", {})
                    branding = item.get("brandingSettings", {})
                    content_details = item.get("contentDetails", {})
                    
                    # Get subscriber count
                    hidden_subs = stats.get("hiddenSubscriberCount", False)
                    sub_count = int(stats.get("subscriberCount", 0)) if not hidden_subs else 0
                    
                    # Filter by subscriber range (unless hidden)
                    if not hidden_subs and (sub_count < min_subscribers or sub_count > max_subscribers):
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": snippet.get("title", ""),
                            "reason": "subscriber_range",
                            "stage": "enrichment",
                            "detail": f"subs = {sub_count:,} (range {min_subscribers:,}–{max_subscribers:,})",
                        })
                        continue
                    
                    # Extract branding links
                    branding_links = branding.get("channel", {}).get("links", [])
                    
                    # Get uploads playlist ID
                    uploads_playlist = content_details.get("relatedPlaylists", {}).get("uploads")
                    
                    # Fetch recent videos
                    recent_videos = []
                    latest_upload_date = None
                    days_since_upload = None
                    video_descriptions_text = ""  # Collected video descriptions
                    
                    if uploads_playlist:
                        try:
                            playlist_response = await _yt_execute(youtube.playlistItems().list(
                                part="snippet,contentDetails",
                                playlistId=uploads_playlist,
                                maxResults=videos_to_fetch
                            ))
                            
                            # Track API call
                            await track_api_call("playlists", 1, user["id"])
                            
                            video_ids = []
                            for vid_item in playlist_response.get("items", []):
                                video_ids.append(vid_item["contentDetails"]["videoId"])
                                recent_videos.append({
                                    "video_id": vid_item["contentDetails"]["videoId"],
                                    "title": vid_item["snippet"]["title"],
                                    "published_at": vid_item["snippet"]["publishedAt"],
                                    "description": ""  # Will be filled if scan_video_descriptions
                                })
                            
                            if recent_videos:
                                latest_upload_date = recent_videos[0]["published_at"]
                                pub_date = datetime.fromisoformat(latest_upload_date.replace("Z", "+00:00"))
                                days_since_upload = (datetime.now(timezone.utc) - pub_date).days
                            
                            # Fetch video statistics (and descriptions if scanning or platform detection enabled)
                            if video_ids:
                                needs_descriptions = scan_video_descriptions or len(affiliate_platforms) > 0
                                parts = ["statistics"]
                                if needs_descriptions:
                                    parts.append("snippet")
                                
                                vid_response = await _yt_execute(youtube.videos().list(
                                    part=",".join(parts),
                                    id=",".join(video_ids)
                                ))
                                
                                # Track API call
                                await track_api_call("videos", 1, user["id"])
                                
                                vid_data = {v["id"]: v for v in vid_response.get("items", [])}
                                for vid in recent_videos:
                                    vid_info = vid_data.get(vid["video_id"], {})
                                    vid["view_count"] = int(vid_info.get("statistics", {}).get("viewCount", 0))
                                    # Store video description if scanning enabled or platforms selected
                                    if needs_descriptions and "snippet" in vid_info:
                                        vid["description"] = vid_info["snippet"].get("description", "")
                                        video_descriptions_text += " " + vid["description"]
                        
                        except HttpError as e:
                            logger.warning(f"Error fetching videos for {ch_id}: {e}")
                            if "quotaExceeded" in str(e):
                                await mark_quota_exceeded(user["id"])
                    
                    # Calculate average views
                    avg_views = 0
                    if recent_videos:
                        views = [v.get("view_count", 0) for v in recent_videos[:3]]
                        avg_views = sum(views) / len(views) if views else 0
                    
                    # Get video titles for scoring
                    video_titles = [v.get("title", "") for v in recent_videos]
                    
                    # Upload recency filter: skip channels that haven't uploaded within the user's threshold
                    if req.uploaded_within_days and days_since_upload is not None:
                        if days_since_upload > req.uploaded_within_days:
                            drops.append({
                                "channel_id": ch_id,
                                "channel_name": snippet.get("title", ""),
                                "reason": "stale_upload",
                                "stage": "enrichment",
                                "detail": f"{days_since_upload}d since upload (threshold {req.uploaded_within_days}d)",
                            })
                            logger.info(f"Skipping stale channel ({days_since_upload}d since upload): {snippet.get('title', ch_id)}")
                            continue
                    
                    # Language filter: skip non-English channels
                    if not is_likely_english(video_titles, snippet.get("title", "")):
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": snippet.get("title", ""),
                            "reason": "language_heuristic",
                            "stage": "enrichment",
                            "detail": "channel title / recent videos do not look English",
                        })
                        logger.info(f"Skipping non-English channel: {snippet.get('title', ch_id)}")
                        continue
                    
                    # Create pipe-separated latest_video_titles field
                    latest_video_titles = " | ".join(video_titles[:5])
                    
                    # Extract public links
                    public_links = extract_public_links(snippet.get("description", ""), branding_links)
                    
                    # Calculate scores using niche-specific keywords
                    score_topic, topic_tags = calculate_topic_score(
                        snippet.get("title", ""),
                        snippet.get("description", ""),
                        video_titles,
                        niche_topic_keywords
                    )
                    score_tutorial = calculate_tutorial_score(
                        snippet.get("title", ""),
                        snippet.get("description", ""),
                        video_titles
                    )
                    score_activity = calculate_activity_score(days_since_upload)
                    score_subscriber = calculate_subscriber_score(sub_count, hidden_subs)
                    score_engagement = calculate_engagement_score(avg_views, sub_count) if not hidden_subs else 5
                    score_contactability = calculate_contactability_score(public_links)
                    
                    score_total = (score_topic + score_tutorial + score_activity + 
                                   score_subscriber + score_engagement + score_contactability)
                    
                    # Detect affiliate signals using niche-specific keywords
                    affiliate_signals = detect_affiliate_signals(
                        snippet.get("title", ""),
                        snippet.get("description", ""),
                        video_titles,
                        niche_affiliate_signal_keywords
                    )
                    
                    # Extended affiliate language detection with niche keywords
                    description = snippet.get("description", "")
                    aff_keywords, aff_count, has_affiliate_language, does_reviews, has_link_in_bio = detect_affiliate_language(
                        description, video_titles, "", niche_affiliate_language_keywords
                    )
                    
                    # Commercial signals detection with niche keywords
                    commercial_signals, commercial_count, product_monetization = detect_commercial_signals(
                        description, "", niche_commercial_keywords
                    )
                    
                    # Brand contact signals detection
                    brand_contact_signals, brand_contact_count = detect_brand_contact_signals(description)
                    
                    # Business email detection
                    has_business_email, business_email = detect_business_email(description)
                    
                    # Affiliate platform link detection.
                    # Under Option A semantics, we ALWAYS scan every named platform
                    # regardless of the user's picker selection — badges surface
                    # everywhere. The `affiliate_platforms` request param is used
                    # by the client only as a *display filter* (see Dashboard.jsx).
                    full_text_to_scan = description + " " + video_descriptions_text
                    affiliate_platform_links, affiliate_platforms_found, affiliate_platforms_count = detect_affiliate_platform_links(
                        full_text_to_scan, list(AFFILIATE_PLATFORMS.keys())
                    )
                    if affiliate_platforms_found:
                        logger.info(f"Affiliate platforms detected for {snippet.get('title', ch_id)}: {affiliate_platforms_found}")

                    # Total affiliate URL count across ALL master patterns (named + unnamed).
                    # Powers the "N aff links" fallback pill when no named platform matched.
                    affiliate_links_total = 0
                    for _link_pattern in MASTER_AFFILIATE_LINK_PATTERNS:
                        affiliate_links_total += len(re.findall(_link_pattern, full_text_to_scan, re.IGNORECASE))
                    
                    # Tool Stack Detection
                    tools_section_detected, tools_stack_signal_score, tools_section_phrases = detect_tools_section(
                        description, video_descriptions_text
                    )
                    
                    # Calculate affiliate score with all signals
                    affiliate_score = calculate_affiliate_score(
                        score_topic, score_tutorial, aff_count, commercial_count, score_engagement,
                        brand_contact_count, has_business_email, tools_stack_signal_score
                    )
                    
                    # Channel Health Indicators
                    upload_consistency, upload_avg_days = calculate_upload_consistency(recent_videos)
                    engagement_health, engagement_rate = calculate_engagement_health(avg_views, sub_count)
                    growth_indicator = calculate_growth_indicator(avg_views, int(stats.get("viewCount", 0)), int(stats.get("videoCount", 0)))
                    
                    # Get metadata
                    meta = channel_metadata.get(ch_id, {})
                    
                    # Geography (YouTube self-declared)
                    ch_country = (snippet.get("country") or "").upper()
                    ch_country_name = country_name_for(ch_country)
                    
                    channel_data = ChannelData(
                        channel_id=ch_id,
                        channel_name=snippet.get("title", ""),
                        channel_url=f"https://www.youtube.com/channel/{ch_id}",
                        description=snippet.get("description", ""),
                        subscriber_count=sub_count,
                        hidden_subscriber_count=hidden_subs,
                        video_count=int(stats.get("videoCount", 0)),
                        view_count=int(stats.get("viewCount", 0)),
                        avg_views_recent=round(avg_views, 0),
                        latest_upload_date=latest_upload_date,
                        days_since_upload=days_since_upload,
                        keywords_found_by=meta.get("keywords_found_by", []),
                        search_source=meta.get("search_source", ""),
                        topic_tags=topic_tags,
                        affiliate_signals=affiliate_signals,
                        public_links=public_links,
                        score_total=score_total,
                        score_topic=score_topic,
                        score_tutorial=score_tutorial,
                        score_activity=score_activity,
                        score_subscriber=score_subscriber,
                        score_engagement=score_engagement,
                        score_contactability=score_contactability,
                        recent_videos=recent_videos,
                        enriched_at=datetime.now(timezone.utc).isoformat(),
                        # New affiliate detection fields
                        latest_video_titles=latest_video_titles,
                        affiliate_signals_count=aff_count,
                        commercial_signals=commercial_signals,
                        commercial_signals_count=commercial_count,
                        affiliate_score=affiliate_score,
                        has_affiliate_language=has_affiliate_language,
                        does_reviews=does_reviews,
                        has_link_in_bio=has_link_in_bio,
                        product_monetization=product_monetization,
                        # Brand contact signals
                        brand_contact_signals=brand_contact_signals,
                        brand_contact_signals_count=brand_contact_count,
                        has_business_email=has_business_email,
                        business_email=business_email,
                        # Affiliate platform links
                        affiliate_platform_links=affiliate_platform_links,
                        affiliate_platforms_found=affiliate_platforms_found,
                        affiliate_platforms_count=affiliate_platforms_count,
                        affiliate_links_total=affiliate_links_total,
                        # Tool Stack Detection
                        tools_section_detected=tools_section_detected,
                        tools_stack_signal_score=tools_stack_signal_score,
                        tools_section_phrases=tools_section_phrases,
                        # Channel Health Indicators
                        upload_consistency=upload_consistency,
                        upload_avg_days=upload_avg_days,
                        engagement_health=engagement_health,
                        engagement_rate=engagement_rate,
                        growth_indicator=growth_indicator,
                        # Geography
                        country=ch_country,
                        country_name=ch_country_name
                    )
                    
                    enriched_channels.append(channel_data.model_dump())
                    
                    # Cache in database (scoped to user)
                    doc = channel_data.model_dump()
                    doc["user_id"] = user["id"]
                    await db.channels.update_one(
                        {"channel_id": ch_id, "user_id": user["id"]},
                        {"$set": doc},
                        upsert=True
                    )
            
            except HttpError as e:
                logger.error(f"Batch enrichment error: {e}")
                if "quotaExceeded" in str(e):
                    raise HTTPException(status_code=429, detail="YouTube API quota exceeded")
        
        # Sort by score
        enriched_channels.sort(key=lambda x: x.get("score_total", 0), reverse=True)
        
        # ===== SUPER SEARCH PIPELINE =====
        # Gated by 12 credit (`draft_credits`) deduction per run with auto-refund
        # on total failure. Soft-capped at 80 channels sent to AI grading.
        # Cached AI grades (from prior runs within the 24h channel cache window)
        # are reused for free.
        SUPER_SEARCH_CREDIT_COST = 12
        SUPER_SEARCH_MAX_AI_CHANNELS = 80
        super_search_meta = {"requested": False}
        if req.super_search:
            super_search_meta["requested"] = True
            logger.info(f"Super Search: Processing {len(enriched_channels)} channels through pipeline (strict_mode={req.strict_mode})")
            super_channels = []
            
            for ch in enriched_channels:
                ch_id = ch.get("channel_id", "")
                ch_name = ch.get("channel_name", "Unknown")
                
                # Step 3: Force Brand Intelligence on every channel
                if not ch.get("sponsorship_data"):
                    try:
                        yt = get_youtube_service(user)
                        ch_resp = await _yt_execute(yt.channels().list(part="contentDetails", id=ch_id))
                        if ch_resp.get("items"):
                            uploads_pl = ch_resp["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
                            pl_resp = await _yt_execute(yt.playlistItems().list(part="contentDetails", playlistId=uploads_pl, maxResults=10))
                            vid_ids = [item["contentDetails"]["videoId"] for item in pl_resp.get("items", [])]
                            if vid_ids:
                                vids_resp = await _yt_execute(yt.videos().list(part="snippet", id=",".join(vid_ids)))
                                videos = [{"video_id": v["id"], "title": v["snippet"]["title"],
                                           "description": v["snippet"]["description"],
                                           "published_at": v["snippet"].get("publishedAt", "")} for v in vids_resp.get("items", [])]
                                sp_result = detect_sponsorships(videos)
                                ch["sponsorship_data"] = sp_result
                                # Cache to DB
                                await db.channels.update_many(
                                    {"channel_id": ch_id},
                                    {"$set": {"sponsorship_data": sp_result, "last_sponsorship_check": datetime.now(timezone.utc)}}
                                )
                            else:
                                ch["sponsorship_data"] = {"is_sponsored_active": False, "detected_brands": [],
                                                          "affiliate_link_count": 0, "confidence_score": 0,
                                                          "videos_analyzed": 0, "videos_with_sponsorships": []}
                    except Exception as e:
                        logger.warning(f"Super Search: Brand Intel failed for {ch_name}: {e}")
                        ch["sponsorship_data"] = {"is_sponsored_active": False, "detected_brands": [],
                                                  "affiliate_link_count": 0, "confidence_score": 0,
                                                  "videos_analyzed": 0, "videos_with_sponsorships": []}
                
                sp = ch.get("sponsorship_data", {})
                aff_link_count = sp.get("affiliate_link_count", 0)
                is_sponsored = sp.get("is_sponsored_active", False)
                vids_with_sp = sp.get("videos_with_sponsorships", [])
                
                # Strict mode (legacy behaviour): require proven affiliate activity before AI grading.
                # When OFF (default), every channel proceeds to AI grading — the AI does the filtering.
                if req.strict_mode:
                    # Step 4: Hard filter — affiliate activity required
                    if aff_link_count == 0 and not is_sponsored:
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": ch_name,
                            "reason": "super_no_affiliate",
                            "stage": "super_search",
                            "detail": "strict mode: no affiliate links or sponsored activity detected",
                        })
                        logger.info(f"Super Search (strict): Filtered out {ch_name} — no affiliate activity")
                        continue
                    
                    # Step 5: Hard filter — minimum 3 affiliate links
                    if aff_link_count < 3:
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": ch_name,
                            "reason": "super_too_few_links",
                            "stage": "super_search",
                            "detail": f"strict mode: affiliate_link_count = {aff_link_count} (min 3)",
                        })
                        logger.info(f"Super Search (strict): Filtered out {ch_name} — only {aff_link_count} affiliate links")
                        continue
                    
                    # Step 6: Hard filter — recency of affiliate activity (90 days)
                    has_recent_sponsored = False
                    cutoff_90 = datetime.now(timezone.utc) - timedelta(days=90)
                    for sv in vids_with_sp:
                        pub = sv.get("published_at", "")
                        if pub:
                            try:
                                pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                                if pub_dt > cutoff_90:
                                    has_recent_sponsored = True
                                    break
                            except Exception:
                                pass
                    if not has_recent_sponsored:
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": ch_name,
                            "reason": "super_no_recent_affiliate",
                            "stage": "super_search",
                            "detail": "strict mode: no sponsored video in the last 90 days",
                        })
                        logger.info(f"Super Search (strict): Filtered out {ch_name} — no recent affiliate activity")
                        continue
                    
                    # Step 7: Hard filter — sponsored video ratio (3+ of last 10)
                    if len(vids_with_sp) < 3:
                        drops.append({
                            "channel_id": ch_id,
                            "channel_name": ch_name,
                            "reason": "super_too_few_sponsored_videos",
                            "stage": "super_search",
                            "detail": f"strict mode: {len(vids_with_sp)}/{sp.get('videos_analyzed', 10)} videos sponsored (min 3)",
                        })
                        logger.info(f"Super Search (strict): Filtered out {ch_name} — only {len(vids_with_sp)}/{sp.get('videos_analyzed', 10)} sponsored videos")
                        continue
                
                # Compute super search display fields
                ch["sponsored_video_ratio"] = f"{len(vids_with_sp)}/{sp.get('videos_analyzed', 10)}"
                
                # Most recent affiliate video date
                most_recent_sp_date = None
                for sv in vids_with_sp:
                    pub = sv.get("published_at", "")
                    if pub:
                        try:
                            pub_dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                            if most_recent_sp_date is None or pub_dt > most_recent_sp_date:
                                most_recent_sp_date = pub_dt
                        except Exception:
                            pass
                if most_recent_sp_date:
                    days_ago = (datetime.now(timezone.utc) - most_recent_sp_date).days
                    ch["affiliate_recency_days"] = days_ago
                    ch["affiliate_recency_label"] = f"{days_ago}d ago" if days_ago > 0 else "Today"
                
                super_channels.append(ch)
            
            logger.info(f"Super Search: {len(super_channels)} channels reached AI grading stage (from {len(enriched_channels)} enriched, strict_mode={req.strict_mode})")
            
            # Step 8: AI Prospect Assessment (OpenAI GPT-4o)
            openai_key = os.environ.get("OPENAI_API_KEY")
            if openai_key and super_channels:
                from openai import OpenAI
                ai_client = OpenAI(api_key=openai_key)

                # Split channels into "already graded recently" (free) vs "needs fresh grading" (paid).
                # A channel keeps a usable cached grade as long as it's still in the 24h channel cache
                # AND has an ai_assessment with a real grade (A/B/C/Reject — Ungraded is not usable).
                channels_to_grade = []
                channels_with_cached_grade = []
                for c in super_channels:
                    cached_grade = (c.get("ai_assessment") or {}).get("grade")
                    if cached_grade in ("A", "B", "C", "Reject"):
                        channels_with_cached_grade.append(c)
                    else:
                        channels_to_grade.append(c)

                # Soft cap: never send more than 80 channels to GPT-4o per run.
                # Cap applies to the to-grade list only; cached ones are free and always returned.
                capped = False
                if len(channels_to_grade) > SUPER_SEARCH_MAX_AI_CHANNELS:
                    extras = channels_to_grade[SUPER_SEARCH_MAX_AI_CHANNELS:]
                    channels_to_grade = channels_to_grade[:SUPER_SEARCH_MAX_AI_CHANNELS]
                    capped = True
                    for c in extras:
                        c["ai_assessment"] = {"grade": "Ungraded", "reason": f"Soft cap of {SUPER_SEARCH_MAX_AI_CHANNELS} channels reached — re-run search to grade the rest."}
                    # Extras still flow through to the final result; just not graded.

                # Credit gate — only charge if there is at least one channel that needs fresh grading.
                will_charge = len(channels_to_grade) > 0
                user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "draft_credits": 1})
                current_credits = (user_doc or {}).get("draft_credits", 0)

                super_search_meta.update({
                    "credits_required": SUPER_SEARCH_CREDIT_COST if will_charge else 0,
                    "cached_grades_used": len(channels_with_cached_grade),
                    "to_grade": len(channels_to_grade),
                    "soft_capped": capped,
                })

                if will_charge:
                    if current_credits < SUPER_SEARCH_CREDIT_COST:
                        raise HTTPException(
                            status_code=402,
                            detail={
                                "error": "insufficient_credits",
                                "message": f"Super Search costs {SUPER_SEARCH_CREDIT_COST} credits. You have {current_credits}. Purchase more to continue.",
                                "credits_required": SUPER_SEARCH_CREDIT_COST,
                                "credits_available": current_credits,
                            },
                        )
                    # Atomic deduction guarded by balance check (prevents race conditions)
                    deduct_res = await db.users.update_one(
                        {"id": user["id"], "draft_credits": {"$gte": SUPER_SEARCH_CREDIT_COST}},
                        {"$inc": {"draft_credits": -SUPER_SEARCH_CREDIT_COST}},
                    )
                    if deduct_res.modified_count == 0:
                        raise HTTPException(status_code=402, detail={"error": "insufficient_credits", "message": "Credits depleted concurrently. Please retry."})
                    super_search_meta["credits_charged"] = SUPER_SEARCH_CREDIT_COST
                else:
                    super_search_meta["credits_charged"] = 0

                # Run the GPT-4o grading loop only on channels that need fresh grading
                grading_attempts = 0
                grading_successes = 0

                # Niche-aware grading rubric.
                # Physical-product niches get a rubric tuned for product
                # reviewers / Amazon affiliates. Everything else keeps the
                # original SaaS-focused prompt unchanged.
                PHYSICAL_PRODUCT_NICHES = {
                    "tech_gadgets", "ecommerce_amazon",
                    "fashion", "lifestyle", "parenting", "home_decor",
                }

                ss_system_prompt_saas = """You are a prospect quality assessor for a B2B SaaS affiliate discovery platform.
You will be given enriched data about a YouTube channel. Your job is to assess
whether this channel's AUDIENCE would be a good fit for a B2B SaaS affiliate
programme — not whether the creator has already run affiliate campaigns.

Return a JSON object only — no preamble, no markdown, no code fences.

Primary criterion (most important):
- Audience fit (PRIMARY criterion): Are the viewers likely to be SaaS founders,
  software buyers, digital marketers, or online business operators who purchase
  and evaluate software tools?
  DOES NOT qualify: trades/home service businesses, local service businesses,
  ecommerce sellers (unless they're evaluating SaaS tools specifically),
  brick-and-mortar operators, or general "business" audiences who don't buy software.

Secondary criteria:
- Channel is active (posted within 60 days)
- Content is primarily in English
- Creator appears commercially aware (professional tone, product-focused content)
- Some affiliate or sponsorship history is a positive signal but NOT required

Red flags (bias toward Reject if multiple present):
- Channel name doesn't match YouTube handle (possible broker/operator)
- Primary contact is a link shortener domain (e.g. ytranker.org, linktree fronting a rate card)
- Content is consumer-facing (make money online, dropshipping, Amazon FBA, faceless channels)
- Creator is selling their own course or coaching as primary business model
- Very high video volume from a recently created channel (content farm signal)
- Channel appears to be a brand/company publishing content to promote their own product
  (look for: channel name matches a known software product, description reads as corporate
  marketing, videos are product demos/case studies/customer stories rather than
  independent reviews)

Grade definitions:
- A — Strong audience fit, active, commercially aware. Prioritise for outreach.
- B — Good audience fit or strong affiliate history. Worth contacting.
- C — Partial fit or notable weakness. Low priority.
- Reject — Wrong audience, red flags present, or inactive.

Return this exact JSON structure:
{"grade":"A|B|C|Reject","reason":"One sentence explaining the grade",
"audience_fit":true|false,
"active_within_60_days":true|false,
"red_flags_present":true|false}"""

                ss_system_prompt_physical = """You are a prospect quality assessor for a physical-product affiliate
discovery platform. You will be given enriched data about a YouTube
channel. Your job is to assess whether this channel is a good fit for a
physical-product affiliate programme — typically Amazon Associates, DTC
brand ambassador / affiliate programmes, or retailer partnerships (Best
Buy, B&H, Walmart, etc.).

Return a JSON object only — no preamble, no markdown, no code fences.

Primary criterion (most important):
- Audience fit (PRIMARY criterion): Are the viewers active product buyers
  — gadget enthusiasts, hobbyist consumers, deal-seekers, or review-content
  consumers who watch in order to make purchase decisions? Strong signal:
  the audience treats this creator as a buying advisor for the category.
  DOES NOT qualify: corporate / B2B-only viewers who don't buy at the
  consumer level, kids-only audiences, faceless lifestyle/vlog content
  with no product focus, or "make money online" / "side hustle" audiences
  who watch to learn schemes rather than evaluate products.
  Note: faceless ASMR or overhead-shot product-demo content with active
  affiliate links DOES qualify — the disqualifier is "no product focus",
  not "no presenter on camera".

Strong positive signals (reward these — they materially lift the grade):
- Multiple Amazon Associates links detected in last 90 days (amzn.to or
  amazon.com/...?tag= patterns). High link density = recent, active
  commercial behaviour.
- Video titles match buyer-intent formats: "best [product]",
  "[product] review", "[product] vs [product]", "unboxing",
  "top X [product]", "[product] comparison". This is the dominant content
  format for high-converting product affiliates.
- Detected affiliate platforms beyond Amazon (Skimlinks, Impact,
  ShareASale, Awin, CJ, retailer-specific programmes).
- Sponsored placements from product brands in the same category.

Secondary criteria:
- Channel is active (posted within 60 days)
- Content is primarily in English
- Creator appears commercially aware (professional tone, clear product
  focus, affiliate disclosure typically present)

Red flags (bias toward Reject if multiple present):
- Channel name doesn't match YouTube handle (possible broker/operator)
- Primary contact is a link shortener domain (e.g. ytranker.org, linktree
  fronting a rate card)
- "Make money online" / dropshipping / faceless / get-rich-quick framing
- Creator is selling their own course or coaching as the primary business
  model
- Very high video volume from a recently created channel (content farm
  signal)
- Channel appears to be a brand/company publishing content to promote
  their own product (channel name matches a known product brand,
  description reads as corporate marketing, videos are official product
  reveals/PR rather than independent reviews)

NOTE: Amazon-affiliate product reviewing is NOT a red flag — it is the
core target persona for this rubric. Do NOT conflate channels reviewing
products and linking Amazon affiliate URLs with Amazon-FBA / dropshipping
grift content. The former is the ideal prospect; the latter is already
captured by the "make money online" red flag above.

Grade definitions:
- A — Strong audience fit AND clear commercial activity: high Amazon
  Associates link density (or comparable affiliate programme) in the
  last 90 days, consistent buyer-intent video format, active uploads.
  Prioritise for outreach.
- B — Good audience fit with EITHER moderate affiliate activity OR strong
  buyer-intent video format (even if not heavily monetised yet). Worth
  contacting — the audience and content type fit.
- C — Partial fit: right audience but inactive, or right format but weak
  signal of affiliate commercial activity, or off-niche overlap. Low
  priority.
- Reject — Wrong audience (B2B-only / MMO / faceless / grift), multiple
  red flags present, or fully inactive.

Return this exact JSON structure:
{"grade":"A|B|C|Reject","reason":"One sentence explaining the grade",
"audience_fit":true|false,
"active_within_60_days":true|false,
"red_flags_present":true|false}"""

                ss_system_prompt = (
                    ss_system_prompt_physical
                    if req.niche in PHYSICAL_PRODUCT_NICHES
                    else ss_system_prompt_saas
                )
                
                graded_channels = []
                for ch in channels_to_grade:
                    grading_attempts += 1
                    try:
                        ch_payload = {
                            "channel_name": ch.get("channel_name", ""),
                            "channel_handle": ch.get("custom_url", "") or ch.get("channel_url", ""),
                            "description": (ch.get("description", "") or "")[:500],
                            "subscriber_count": ch.get("subscriber_count", 0),
                            "video_count": ch.get("video_count", 0),
                            "avg_views_recent": ch.get("avg_views_recent", 0),
                            "days_since_upload": ch.get("days_since_upload"),
                            "upload_consistency": ch.get("upload_consistency", ""),
                            "country": ch.get("country", ""),
                            "public_links": ch.get("public_links", {}),
                            "affiliate_signals": ch.get("affiliate_signals", []),
                            "affiliate_platforms_found": ch.get("affiliate_platforms_found", []),
                            "affiliate_link_count": ch.get("sponsorship_data", {}).get("affiliate_link_count", 0),
                            "videos_with_sponsorships": [{"title": v.get("title", ""), "signals": v.get("signals", []), "published_at": v.get("published_at", "")} for v in ch.get("sponsorship_data", {}).get("videos_with_sponsorships", [])],
                            "detected_brands": ch.get("sponsorship_data", {}).get("detected_brands", []),
                            "latest_video_titles": ch.get("latest_video_titles", ""),
                            "niche": req.niche,
                        }
                        completion = ai_client.chat.completions.create(
                            model="gpt-4o",
                            messages=[
                                {"role": "system", "content": ss_system_prompt},
                                {"role": "user", "content": json.dumps(ch_payload)},
                            ],
                            max_tokens=200,
                            temperature=0.3,
                        )
                        raw = completion.choices[0].message.content.strip()
                        assessment = json.loads(raw)
                        ch["ai_assessment"] = assessment
                        grading_successes += 1
                        # Persist the grade onto the channel cache doc so future runs reuse it for free
                        try:
                            await db.channels.update_one(
                                {"channel_id": ch.get("channel_id"), "user_id": user["id"]},
                                {"$set": {"ai_assessment": assessment}},
                            )
                        except Exception as cache_err:
                            logger.warning(f"Failed to cache ai_assessment for {ch.get('channel_name')}: {cache_err}")
                    except Exception as e:
                        logger.warning(f"Super Search: AI assessment failed for {ch.get('channel_name')}: {e}")
                        ch["ai_assessment"] = {"grade": "Ungraded", "reason": "AI assessment unavailable"}
                    graded_channels.append(ch)

                # Auto-refund if every single AI call failed and we charged credits
                if will_charge and grading_attempts > 0 and grading_successes == 0:
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$inc": {"draft_credits": SUPER_SEARCH_CREDIT_COST}},
                    )
                    super_search_meta["credits_charged"] = 0
                    super_search_meta["refunded"] = True
                    logger.warning(f"Super Search: refunded {SUPER_SEARCH_CREDIT_COST} credits — every AI call failed for user {user.get('email')}")

                super_search_meta["graded_now"] = grading_successes
                super_search_meta["grading_failed"] = grading_attempts - grading_successes

                # Combine fresh grades + cached grades + any soft-capped extras (already in graded list as Ungraded)
                # Order is preserved by walking super_channels in original sequence
                graded_map = {c.get("channel_id"): c for c in graded_channels}
                cached_map = {c.get("channel_id"): c for c in channels_with_cached_grade}
                combined = []
                for c in super_channels:
                    cid = c.get("channel_id")
                    combined.append(graded_map.get(cid) or cached_map.get(cid) or c)
                super_channels = combined
            
            # Step 9: Competitor Brand Overlap Detection
            comp_brands = set(b.lower().strip() for b in req.competitor_brands if b.strip())
            if comp_brands:
                for ch in super_channels:
                    detected = set(b.lower() for b in ch.get("sponsorship_data", {}).get("detected_brands", []))
                    overlap = detected & comp_brands
                    ch["competitor_brand_overlap"] = len(overlap) > 0
                    ch["competitor_brands_found"] = [b for b in ch.get("sponsorship_data", {}).get("detected_brands", []) if b.lower() in comp_brands]
            
            logger.info(f"Super Search: Final result — {len(super_channels)} qualified channels")
            enriched_channels = super_channels
        
        enriched_channels = filter_channels_by_country(enriched_channels, req.target_countries, req.include_unknown_country, drops)
        return {
            "channels": enriched_channels,
            "total": len(enriched_channels),
            "cached": len(cached_channels),
            "drops": drops,
            "super_search": super_search_meta if super_search_meta.get("requested") else None,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrichment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Shortlist endpoints
@api_router.post("/shortlist")
async def add_to_shortlist(item: ShortlistItem, user=Depends(get_current_user)):
    """Add channel to shortlist"""
    await db.shortlist.update_one(
        {"channel_id": item.channel_id, "user_id": user["id"]},
        {"$set": {"channel_id": item.channel_id, "user_id": user["id"], "added_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True}

@api_router.delete("/shortlist/{channel_id}")
async def remove_from_shortlist(channel_id: str, user=Depends(get_current_user)):
    """Remove channel from shortlist"""
    await db.shortlist.delete_one({"channel_id": channel_id, "user_id": user["id"]})
    return {"success": True}

@api_router.get("/shortlist")
async def get_shortlist(user=Depends(get_current_user)):
    """Get all shortlisted channel IDs"""
    items = await db.shortlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return {"channel_ids": [item["channel_id"] for item in items]}

# Notes endpoint
@api_router.put("/channels/{channel_id}/notes")
async def update_notes(channel_id: str, input: UpdateNotesInput, user=Depends(get_current_user)):
    """Update notes for a channel"""
    await db.channels.update_one(
        {"channel_id": channel_id, "user_id": user["id"]},
        {"$set": {"notes": input.notes}}
    )
    return {"success": True}

# ==================== EXCLUDED CHANNELS ====================

@api_router.post("/channels/{channel_id}/exclude")
async def exclude_channel(channel_id: str, user=Depends(get_current_user)):
    """Exclude a channel from future searches for this user."""
    await db.excluded_channels.update_one(
        {"user_id": user["id"], "channel_id": channel_id},
        {"$set": {
            "user_id": user["id"],
            "channel_id": channel_id,
            "excluded_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True}


@api_router.delete("/channels/{channel_id}/exclude")
async def unexclude_channel(channel_id: str, user=Depends(get_current_user)):
    """Remove a channel from the exclusion list."""
    await db.excluded_channels.delete_one({"user_id": user["id"], "channel_id": channel_id})
    return {"success": True}


@api_router.get("/channels/excluded")
async def get_excluded_channels(user=Depends(get_current_user)):
    """Get list of excluded channel IDs for this user."""
    excluded = await db.excluded_channels.find(
        {"user_id": user["id"]}, {"_id": 0, "channel_id": 1, "excluded_at": 1}
    ).to_list(length=10000)
    return {"excluded": excluded, "count": len(excluded)}


# ==================== SPONSORSHIP DETECTION ====================

SPONSORSHIP_PATTERNS = [
    # Explicit sponsorship language
    (r"(?i)(?:sponsored|presented|brought to you)\s+by\s+([A-Z][\w\s&'.-]{1,40})", "sponsor"),
    (r"(?i)thanks?\s+to\s+([A-Z][\w\s&'.-]{1,40})\s+for\s+(?:sponsoring|supporting|partnering)", "sponsor"),
    (r"(?i)this\s+(?:video|episode|segment)\s+is\s+(?:sponsored|supported)\s+by\s+([A-Z][\w\s&'.-]{1,40})", "sponsor"),
    (r"(?i)(?:partner(?:ship)?|collaboration|collab)\s+with\s+([A-Z][\w\s&'.-]{1,40})", "sponsor"),
    # Discount/promo codes
    (r"(?i)(?:discount|promo|coupon)\s+code[:\s]+['\"]?(\w+)['\"]?", "promo_code"),
    (r"(?i)use\s+(?:my\s+)?code\s+['\"]?(\w+)['\"]?", "promo_code"),
    (r"(?i)(\d+%?\s*off)\s+(?:with|using)\s+(?:code|link)", "promo_code"),
    # Bare code followed by "at checkout" / "at the checkout" — no "use" or "code" label.
    # Requires ≥2 chars, ≤20, mixed alnum with at least one letter and one digit-or-uppercase
    # to avoid matching common English words. Anchored on a word boundary preceded by
    # whitespace/quote/paren to reduce noise. Examples matched:
    #   "SAVE20 at checkout", "MEG15 at the checkout", "GET10OFF at checkout"
    (r"(?i)(?:^|[\s\"'(\[])([A-Z0-9]{2,20})\s+at\s+(?:the\s+)?checkout\b", "promo_code"),
    # FTC / disclosure
    (r"(?i)#(?:ad|sponsored|paidpartnership|partner)", "disclosure"),
    (r"(?i)includes?\s+paid\s+(?:promotion|partnership)", "disclosure"),
]

AFFILIATE_LINK_PATTERNS = MASTER_AFFILIATE_LINK_PATTERNS


def detect_sponsorships(videos):
    """Analyze video titles & descriptions for sponsorship signals.
    
    Args:
        videos: list of dicts with keys: video_id, title, description
    
    Returns:
        dict with sponsorship_data
    """
    detected_brands = set()
    detected_promo_codes = set()  # actual code strings (SAVE20, MEG15, ...)
    affiliate_link_count = 0
    disclosure_count = 0
    promo_code_count = 0
    videos_with_sponsorships = []

    # Words that look like codes but aren't (all-caps English tokens ≤20 chars
    # that occasionally precede "at checkout" in fashion/lifestyle copy).
    PROMO_CODE_STOPWORDS = {
        "FREE", "SALE", "SHIP", "SHIPPING", "OFF", "NEW", "GIFT",
        "HERE", "NOW", "TODAY", "ORDER", "CART", "SIZE",
    }

    def _looks_like_promo_code(s: str) -> bool:
        if not s:
            return False
        s = s.strip()
        # Reject percentage phrases captured by "\d+% off" pattern
        if "%" in s or " " in s:
            return False
        if len(s) < 2 or len(s) > 20:
            return False
        # Must contain at least one letter (rejects pure numbers like "2024")
        if not any(ch.isalpha() for ch in s):
            return False
        if s.upper() in PROMO_CODE_STOPWORDS:
            return False
        return True

    for video in videos:
        desc = video.get("description", "")
        title = video.get("title", "")
        combined = f"{title}\n{desc}"
        video_signals = []

        # Check sponsorship patterns
        for pattern, signal_type in SPONSORSHIP_PATTERNS:
            matches = re.finditer(pattern, combined)
            for match in matches:
                if signal_type == "sponsor":
                    brand = match.group(1).strip().rstrip(".,!?")
                    # Filter out common false positives
                    if len(brand) > 2 and brand.lower() not in ("the", "this", "our", "and", "for", "you", "your", "my"):
                        detected_brands.add(brand)
                        video_signals.append(f"Sponsor: {brand}")
                elif signal_type == "promo_code":
                    promo_code_count += 1
                    # Capture the actual code string if the pattern has a group
                    # AND it looks like a real code (not a "% off" phrase).
                    try:
                        raw = match.group(1) if match.groups() else ""
                    except IndexError:
                        raw = ""
                    if _looks_like_promo_code(raw):
                        detected_promo_codes.add(raw.upper())
                        video_signals.append(f"Code: {raw.upper()}")
                    else:
                        video_signals.append("Promo code")
                elif signal_type == "disclosure":
                    disclosure_count += 1
                    video_signals.append("Disclosure tag")

        # Check affiliate links
        video_aff_links = 0
        for link_pattern in AFFILIATE_LINK_PATTERNS:
            found = re.findall(link_pattern, desc, re.IGNORECASE)
            video_aff_links += len(found)
        affiliate_link_count += video_aff_links
        if video_aff_links > 0:
            video_signals.append(f"{video_aff_links} affiliate link(s)")

        if video_signals:
            videos_with_sponsorships.append({
                "video_id": video.get("video_id"),
                "title": title,
                "signals": video_signals,
            })

    # Confidence score: 0-100 based on signal density
    total_videos = len(videos) if videos else 1
    signal_ratio = len(videos_with_sponsorships) / total_videos
    brand_score = min(len(detected_brands) * 15, 40)
    link_score = min(affiliate_link_count * 5, 30)
    disclosure_score = min(disclosure_count * 10, 20)
    promo_score = min(promo_code_count * 5, 10)
    confidence = min(int(brand_score + link_score + disclosure_score + promo_score + signal_ratio * 20), 100)

    return {
        "is_sponsored_active": len(videos_with_sponsorships) > 0,
        "detected_brands": sorted(detected_brands),
        "affiliate_link_count": affiliate_link_count,
        "disclosure_count": disclosure_count,
        "promo_code_count": promo_code_count,
        # Cap surfaced codes at 10 to keep the UI clean and payload bounded.
        "detected_promo_codes": sorted(detected_promo_codes)[:10],
        "confidence_score": confidence,
        "videos_analyzed": len(videos),
        "videos_with_sponsorships": videos_with_sponsorships,
    }


@api_router.get("/channels/{channel_id}/sponsorship-data")
async def get_sponsorship_data(channel_id: str, user=Depends(get_current_user)):
    """On-demand sponsorship analysis for a channel. Uses 7-day cache."""
    
    # Check cache first
    channel = await db.channels.find_one(
        {"channel_id": channel_id},
        {"_id": 0, "sponsorship_data": 1, "last_sponsorship_check": 1}
    )
    
    if channel and channel.get("last_sponsorship_check"):
        last_check = channel["last_sponsorship_check"]
        # Handle both timezone-aware and naive datetimes from MongoDB
        if last_check.tzinfo is None:
            last_check = last_check.replace(tzinfo=timezone.utc)
        cache_age = (datetime.now(timezone.utc) - last_check).days
        if cache_age < 7 and channel.get("sponsorship_data"):
            return channel["sponsorship_data"]
    
    # Fetch last 10 videos from YouTube
    try:
        youtube = get_youtube_service(user)
        
        # Get uploads playlist ID
        ch_response = await _yt_execute(youtube.channels().list(
            part="contentDetails",
            id=channel_id
        ))
        
        if not ch_response.get("items"):
            return {"is_sponsored_active": False, "detected_brands": [], "affiliate_link_count": 0,
                    "confidence_score": 0, "videos_analyzed": 0, "videos_with_sponsorships": []}
        
        uploads_playlist = ch_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        
        # Get last 10 video IDs
        playlist_response = await _yt_execute(youtube.playlistItems().list(
            part="contentDetails",
            playlistId=uploads_playlist,
            maxResults=10
        ))
        
        video_ids = [item["contentDetails"]["videoId"] for item in playlist_response.get("items", [])]
        
        if not video_ids:
            empty_result = {"is_sponsored_active": False, "detected_brands": [], "affiliate_link_count": 0,
                           "confidence_score": 0, "videos_analyzed": 0, "videos_with_sponsorships": []}
            await db.channels.update_many(
                {"channel_id": channel_id},
                {"$set": {"sponsorship_data": empty_result, "last_sponsorship_check": datetime.now(timezone.utc)}}
            )
            return empty_result
        
        # Fetch video details (title + description)
        videos_response = await _yt_execute(youtube.videos().list(
            part="snippet",
            id=",".join(video_ids)
        ))
        
        videos = []
        for item in videos_response.get("items", []):
            videos.append({
                "video_id": item["id"],
                "title": item["snippet"]["title"],
                "description": item["snippet"]["description"],
            })
        
        # Run detection
        result = detect_sponsorships(videos)
        
        # Cache to DB (update all copies of this channel across users)
        await db.channels.update_many(
            {"channel_id": channel_id},
            {"$set": {"sponsorship_data": result, "last_sponsorship_check": datetime.now(timezone.utc)}}
        )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sponsorship detection error for {channel_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze sponsorship data")

# ==================== OUTREACH STATUS TRACKING ====================

OUTREACH_STATUSES = [
    "not_contacted",
    "contacted",
    "replied",
    "in_negotiation",
    "agreed",
    "declined",
    "no_response"
]

class UpdateOutreachStatusInput(BaseModel):
    status: str
    note: Optional[str] = None
    project_name: Optional[str] = None

class UpdateFollowUpDateInput(BaseModel):
    follow_up_date: Optional[str] = None  # ISO date string or null to clear

async def _cache_sponsorship_data(channel_id: str, user: Optional[Dict[str, Any]] = None):
    """Background task to pre-cache sponsorship data for a channel.

    `user` is passed through so admin-initiated pre-caches use the admin YouTube
    API key quota instead of the regular user key. Defaults to None for
    backwards-compat with any caller that hasn't been updated.
    """
    try:
        youtube = get_youtube_service(user)
        ch_response = await _yt_execute(youtube.channels().list(part="contentDetails", id=channel_id))
        if not ch_response.get("items"):
            return
        uploads_playlist = ch_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        playlist_response = await _yt_execute(youtube.playlistItems().list(
            part="contentDetails", playlistId=uploads_playlist, maxResults=10
        ))
        video_ids = [item["contentDetails"]["videoId"] for item in playlist_response.get("items", [])]
        if not video_ids:
            empty_result = {"is_sponsored_active": False, "detected_brands": [], "affiliate_link_count": 0,
                           "confidence_score": 0, "videos_analyzed": 0, "videos_with_sponsorships": []}
            await db.channels.update_many(
                {"channel_id": channel_id},
                {"$set": {"sponsorship_data": empty_result, "last_sponsorship_check": datetime.now(timezone.utc)}}
            )
            return
        videos_response = await _yt_execute(youtube.videos().list(part="snippet", id=",".join(video_ids)))
        videos = [{"video_id": item["id"], "title": item["snippet"]["title"],
                    "description": item["snippet"]["description"]} for item in videos_response.get("items", [])]
        result = detect_sponsorships(videos)
        await db.channels.update_many(
            {"channel_id": channel_id},
            {"$set": {"sponsorship_data": result, "last_sponsorship_check": datetime.now(timezone.utc)}}
        )
        logger.info(f"Background sponsorship cache complete for {channel_id}")
    except Exception as e:
        logger.error(f"Background sponsorship cache error for {channel_id}: {e}")

@api_router.patch("/channels/{channel_id}/outreach-status")
async def update_outreach_status(channel_id: str, input: UpdateOutreachStatusInput, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    """Update outreach status and add a contact log entry"""
    # Check pipeline access
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    if not tier_config.get("pipeline_access"):
        raise HTTPException(status_code=403, detail="Pipeline access requires Starter or Pro plan.")
    
    # Check project limit for starter tier
    if input.project_name and tier_config.get("max_pipeline_projects") is not None:
        existing_projects = await db.channels.distinct("project_name", {"user_id": user["id"], "project_name": {"$exists": True, "$nin": [None, ""]}})
        if input.project_name not in existing_projects and len(existing_projects) >= tier_config["max_pipeline_projects"]:
            raise HTTPException(status_code=403, detail=f"Starter plan limited to {tier_config['max_pipeline_projects']} projects. Upgrade to Pro for unlimited.")
    
    if input.status not in OUTREACH_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(OUTREACH_STATUSES)}")
    
    # Check if channel exists for this user
    channel = await db.channels.find_one({"channel_id": channel_id, "user_id": user["id"]})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Auto-cache sponsorship data if channel is being added to pipeline and has no cached data
    was_not_contacted = (channel.get("outreach_status") or "not_contacted") == "not_contacted"
    is_entering_pipeline = input.status != "not_contacted"
    has_no_cache = not channel.get("sponsorship_data") or not channel.get("last_sponsorship_check")
    if was_not_contacted and is_entering_pipeline and has_no_cache:
        background_tasks.add_task(_cache_sponsorship_data, channel_id, user)
    
    # Create contact log entry
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": input.status,
        "note": input.note or ""
    }
    
    # Build the $set dict
    set_fields = {"outreach_status": input.status}
    if input.project_name is not None:
        set_fields["project_name"] = input.project_name

    # Update status and add to contact log
    await db.channels.update_one(
        {"channel_id": channel_id, "user_id": user["id"]},
        {
            "$set": set_fields,
            "$push": {"contact_log": log_entry}
        }
    )
    
    return {"success": True, "status": input.status, "log_entry": log_entry, "project_name": input.project_name}

@api_router.patch("/channels/{channel_id}/follow-up-date")
async def update_follow_up_date(channel_id: str, input: UpdateFollowUpDateInput, user=Depends(get_current_user)):
    """Update the follow-up date for a channel"""
    # Check if channel exists for this user
    channel = await db.channels.find_one({"channel_id": channel_id, "user_id": user["id"]})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Update follow-up date (can be null to clear)
    await db.channels.update_one(
        {"channel_id": channel_id, "user_id": user["id"]},
        {"$set": {"follow_up_date": input.follow_up_date}}
    )
    
    return {"success": True, "follow_up_date": input.follow_up_date}

@api_router.get("/channels/follow-ups/due")
async def get_due_follow_ups(user=Depends(get_current_user)):
    """Get all channels where follow_up_date is today or earlier and status is not agreed or declined"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find channels with due follow-ups
    channels = await db.channels.find(
        {
            "user_id": user["id"],
            "follow_up_date": {"$lte": today, "$ne": None},
            "outreach_status": {"$nin": ["agreed", "declined"]}
        },
        {"_id": 0}
    ).to_list(500)
    
    return {"channels": channels, "count": len(channels)}

@api_router.get("/channels/by-outreach-status")
async def get_channels_by_outreach_status(
    status: Optional[str] = Query(default=None, description="Filter by outreach status"),
    project: Optional[str] = Query(default=None, description="Filter by project name"),
    user=Depends(get_current_user)
):
    """Get all channels that have been contacted (have outreach_status set), optionally filtered by status and project"""
    query = {
        "user_id": user["id"],
        "$or": [
            {"outreach_status": {"$exists": True, "$ne": "not_contacted"}},
            {"project_name": {"$exists": True, "$nin": [None, ""]}}
        ]
    }
    
    if status and status != "all":
        if status not in OUTREACH_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(OUTREACH_STATUSES)}")
        query["outreach_status"] = status
    
    if project and project != "all":
        query["project_name"] = project
    
    channels = await db.channels.find(query, {"_id": 0}).sort("enriched_at", -1).to_list(500)
    
    # Group by status for summary
    status_counts = {}
    for ch in channels:
        st = ch.get("outreach_status", "not_contacted")
        status_counts[st] = status_counts.get(st, 0) + 1
    
    return {
        "channels": channels,
        "total": len(channels),
        "status_counts": status_counts
    }

@api_router.get("/channels/outreach-statuses")
async def get_outreach_statuses():
    """Get list of valid outreach statuses"""
    return {"statuses": OUTREACH_STATUSES}

@api_router.get("/pipeline/projects")
async def get_pipeline_projects(user=Depends(get_current_user)):
    """Get list of unique project names for the current user's pipeline channels"""
    pipeline = db.channels.find(
        {"user_id": user["id"], "project_name": {"$exists": True, "$nin": [None, ""]}},
        {"project_name": 1, "_id": 0}
    )
    items = await pipeline.to_list(1000)
    projects = sorted(set(item["project_name"] for item in items if item.get("project_name")))
    return {"projects": projects}

class UpdateProjectNameInput(BaseModel):
    project_name: Optional[str] = None

@api_router.patch("/channels/{channel_id}/project-name")
async def update_channel_project_name(channel_id: str, input: UpdateProjectNameInput, user=Depends(get_current_user)):
    """Update the project name for a channel"""
    channel = await db.channels.find_one({"channel_id": channel_id, "user_id": user["id"]})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.channels.update_one(
        {"channel_id": channel_id, "user_id": user["id"]},
        {"$set": {"project_name": input.project_name or ""}}
    )
    return {"success": True, "project_name": input.project_name}

@api_router.delete("/channels/{channel_id}/pipeline")
async def remove_from_pipeline(channel_id: str, user=Depends(get_current_user)):
    """Remove a channel from the pipeline by resetting outreach fields"""
    channel = await db.channels.find_one({"channel_id": channel_id, "user_id": user["id"]})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.channels.update_one(
        {"channel_id": channel_id, "user_id": user["id"]},
        {"$set": {"outreach_status": "not_contacted", "project_name": None, "follow_up_date": None, "contact_log": []}}
    )
    return {"success": True}

@api_router.post("/channels/{channel_id}/ai-draft")
async def generate_ai_draft(channel_id: str, user=Depends(get_current_user)):
    """Generate an AI outreach email draft for a pipeline channel. Paid tiers only."""
    tier = get_user_tier(user)
    is_admin = user.get("role") == "admin"
    is_paid = tier in ("starter", "pro")

    if not is_admin and not is_paid:
        raise HTTPException(status_code=403, detail="AI Draft requires a Starter or Pro plan.")

    # Credit check for non-admin users
    if not is_admin:
        user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "draft_credits": 1, "outreach_config": 1})
        credits = (user_data or {}).get("draft_credits", 0)
        if credits <= 0:
            raise HTTPException(status_code=402, detail="No draft credits remaining. Purchase more to continue.")
        outreach_config = (user_data or {}).get("outreach_config", {})
        if not outreach_config.get("product_name"):
            raise HTTPException(status_code=400, detail="Please complete your Outreach Settings before generating drafts.")

    channel = await db.channels.find_one({"channel_id": channel_id, "user_id": user["id"]}, {"_id": 0})
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    channel_name = channel.get("channel_name", "Creator")
    recent_videos = channel.get("recent_videos", [])
    video_titles = [v.get("title", "") for v in recent_videos[:10]]
    video_titles_str = "\n".join(f"- {t}" for t in video_titles) if video_titles else "No recent videos available"
    topic_tags = channel.get("topic_tags", [])
    affiliate_signals = channel.get("affiliate_signals", [])
    tags_str = ", ".join(topic_tags + affiliate_signals) if (topic_tags or affiliate_signals) else "General content"
    aff_score = channel.get("affiliate_score", 0)
    business_email = channel.get("business_email", "")

    # Build prompt based on admin vs paid user
    if is_admin:
        system_msg = "You are the solo founder of Affilitube. Your goal is to write a one-to-one, plain-text email that feels like it was typed manually in 30 seconds. Be humble but direct. No marketing speak. No exclamation marks. Calm, professional, slightly casual. Think of how a real person would write a quick email to someone they genuinely respect. IMPORTANT: always separate each thought into its own short paragraph with a blank line between them. Never write a wall of text."
        prompt = f"""Write a one-to-one, plain-text outreach email to {channel_name}.

Here are their recent video titles (pick ONE to reference):
{video_titles_str}

Their niche/tags: {tags_str}
Their affiliate score: {aff_score}/100

Follow this structure exactly:

1. THE "I'M A HUMAN" OPENING: Use the line "I know you must get lots of emails like this and I don't want to waste your time..."

2. THE SPECIFIC HOOK: Mention one specific video title from the list above. Keep it simple: "I caught your video about [Title]—really liked the part where you [infer a small detail or keep it brief]."

3. THE "WHY YOU" REVEAL: Say: "we built this tool that helps small and medium creators/brands find influencers and affiliates... and to be honest, we actually used the tool itself to find you."

4. THE VALUE: Explain that you'd love to have them as an early affiliate partner because they actually move the needle in the {tags_str} space.

5. THE SHORT CTA: End with "would you be open to a 2-minute look at it? no worries if not." Then on a new line add: "if you're interested in how Affilitube works you can see the app here www.affilitube.com. if you'd like a free trial to see how it works let me know and I'll set it up for you." Then on a new line add: "we also run a partner program with up to 40% recurring commissions if it's something you'd be open to — details here www.affilitube.com/affilitube-affiliate-program." Then sign off with a new line "regards" new line "Adrian" new line "Affilitube Founder"

Constraints:
- Plain text only. No bolding, no formatting, no markdown.
- No exclamation marks. Keep the energy calm and professional.
- Slightly casual style (use contractions like "we've", "don't", start some sentences with "but" or "so").
- Lowercase is okay for a natural feel.
- Absolutely avoid these words: synergy, boost, empower, cutting-edge, match made in heaven, knacks, unlock, leverage, game-changer.
- Keep it under 170 words.
- CRITICAL: Each of the 5 sections above MUST be its own short paragraph separated by a blank line. Do NOT write the email as one big block of text.

Format your response EXACTLY as:
SUBJECT: [a short, lowercase, non-marketing subject line]
---
[paragraph 1: the opening]

[paragraph 2: the hook]

[paragraph 3: the why you reveal]

[paragraph 4: the value]

[paragraph 5: the CTA and demo link]"""
    else:
        # Dynamic template from user's outreach config
        oc = outreach_config
        product_name = oc.get("product_name", "our product")
        target_audience = oc.get("target_audience", "creators and brands")
        value_prop = oc.get("value_prop", "find the right partners")
        tone = oc.get("tone", "casual-professional")
        custom_closing = oc.get("custom_closing", "would you be open to a quick look? no worries if not.")
        product_url = oc.get("product_url", "")
        sender_name = oc.get("sender_name", "")

        tone_instruction = {
            "casual": "Very casual and friendly, like texting a colleague. Use lowercase, contractions, keep it light.",
            "professional": "Polite and professional but still warm. Proper capitalization, clear sentences.",
            "bold": "Confident and direct. Short punchy sentences. Get to the point fast.",
        }.get(tone, "Friendly and casual-professional. Use contractions, be genuine.")

        system_msg = f"You are the founder of {product_name}. Your goal is to write a one-to-one, plain-text email that feels like it was typed manually. {tone_instruction} No marketing jargon. No exclamation marks. IMPORTANT: always separate each thought into its own short paragraph with a blank line between them."

        closing_line = custom_closing
        if product_url:
            closing_line += f"\n\nif you want to check it out: {product_url}"
        sign_off = f"\n\n{sender_name}" if sender_name else ""

        prompt = f"""Write a one-to-one, plain-text outreach email to {channel_name}.

Here are their recent video titles (pick ONE to reference):
{video_titles_str}

Their niche/tags: {tags_str}

Follow this structure:

1. OPENING: A brief, human opening line acknowledging they probably get lots of emails.

2. THE HOOK: Mention one specific video title from the list above. Reference something specific about it.

3. THE CONNECTION: Explain that {product_name} helps {target_audience} by {value_prop}. Keep it brief and genuine.

4. THE ASK: Propose working together — explain why they specifically would be a great fit for the {tags_str} space.

5. THE CLOSING: End with: "{closing_line}"{sign_off}

Constraints:
- Plain text only. No bolding, no formatting, no markdown.
- No exclamation marks. Keep the energy calm.
- Absolutely avoid: synergy, boost, empower, cutting-edge, leverage, game-changer.
- Keep it under 150 words.
- CRITICAL: Each section MUST be its own short paragraph separated by a blank line.

Format your response EXACTLY as:
SUBJECT: [a short, non-marketing subject line]
---
[paragraph 1]

[paragraph 2]

[paragraph 3]

[paragraph 4]

[paragraph 5]"""

    try:
        from openai import OpenAI

        client = OpenAI(api_key=openai_key)

        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
            temperature=0.85,
        )

        response = completion.choices[0].message.content.strip()

        subject = ""
        body = response
        if "SUBJECT:" in body and "---" in body:
            parts = body.split("---", 1)
            subject = parts[0].replace("SUBJECT:", "").strip()
            body = parts[1].strip()

        # Ensure paragraph breaks
        if "\n\n" not in body and len(body) > 200:
            import re
            for marker in [
                r"(?i)(i caught your video)",
                r"(?i)(we built this tool)",
                r"(?i)(we'?d love to have)",
                r"(?i)(would you be open)",
                r"(?i)(if you'?re interested)",
                r"(?i)(if you want to check)",
            ]:
                body = re.sub(marker, r"\n\n\1", body)
            body = body.strip()

        # Deduct credit for non-admin
        if not is_admin:
            await db.users.update_one(
                {"id": user["id"], "draft_credits": {"$gt": 0}},
                {"$inc": {"draft_credits": -1}}
            )

        return {
            "subject": subject,
            "body": body,
            "business_email": business_email,
            "channel_name": channel_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI draft error for {channel_id}: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


class OutreachConfigInput(BaseModel):
    product_name: str
    target_audience: str
    value_prop: str
    tone: str = "casual-professional"
    custom_closing: str = ""
    product_url: str = ""
    sender_name: str = ""

@api_router.get("/user/outreach-config")
async def get_outreach_config(user=Depends(get_current_user)):
    """Get user's outreach configuration"""
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "outreach_config": 1})
    return {"outreach_config": (user_data or {}).get("outreach_config", {})}

@api_router.put("/user/outreach-config")
async def update_outreach_config(config: OutreachConfigInput, user=Depends(get_current_user)):
    """Save/update user's outreach configuration"""
    tier = get_user_tier(user)
    if tier not in ("starter", "pro") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Outreach config requires a paid plan.")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"outreach_config": config.model_dump()}}
    )
    return {"success": True}

@api_router.get("/user/draft-credits")
async def get_draft_credits(user=Depends(get_current_user)):
    """Get user's current draft credit balance"""
    user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "draft_credits": 1})
    return {"draft_credits": (user_data or {}).get("draft_credits", 0)}

class CreditsCheckoutRequest(BaseModel):
    endorsely_referral: Optional[str] = None

@api_router.post("/checkout/credits")
async def create_credits_checkout(data: CreditsCheckoutRequest, request: Request, user=Depends(get_current_user)):
    """Create a Stripe checkout session for purchasing 500 AI draft credits ($9.99)"""
    tier = get_user_tier(user)
    if tier not in ("starter", "pro"):
        raise HTTPException(status_code=403, detail="Credit purchase requires a Starter or Pro plan.")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    stripe_sdk.api_key = STRIPE_API_KEY

    # Get or auto-create the credits price
    credits_price_id = os.environ.get("STRIPE_CREDITS_PRICE_ID")
    if credits_price_id:
        try:
            stripe_sdk.Price.retrieve(credits_price_id)
        except Exception:
            credits_price_id = None

    if not credits_price_id:
        try:
            product = stripe_sdk.Product.create(name="AI Draft Credits", description="500 AI outreach email draft credits for Affilitube")
            price = stripe_sdk.Price.create(product=product.id, unit_amount=999, currency="usd")
            credits_price_id = price.id
            logger.info(f"Auto-created credits price: {credits_price_id}")
        except Exception as e:
            logger.error(f"Failed to create credits price: {e}")
            raise HTTPException(status_code=500, detail="Failed to configure credits product")

    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    origin = request.headers.get("origin") or f"{proto}://{host}".rstrip("/")

    try:
        user_data = await db.users.find_one({"id": user["id"]}, {"_id": 0, "stripe_customer_id": 1})
        stripe_customer_id = (user_data or {}).get("stripe_customer_id")

        checkout_params = {
            "mode": "payment",
            "line_items": [{"price": credits_price_id, "quantity": 1}],
            "success_url": f"{origin}/dashboard/pipeline?credits_purchased=true",
            "cancel_url": f"{origin}/dashboard/pipeline",
            "metadata": {
                "user_id": user["id"],
                "user_email": user["email"],
                "product": "ai_draft_credits",
                "credits_amount": "500",
                **({"endorsely_referral": data.endorsely_referral} if data.endorsely_referral else {}),
            },
        }

        if stripe_customer_id:
            checkout_params["customer"] = stripe_customer_id
        else:
            checkout_params["customer_email"] = user["email"]

        session = stripe_sdk.checkout.Session.create(**checkout_params)
    except Exception as e:
        logger.error(f"Credits checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

    return {"url": session.url, "session_id": session.id}



class AutoSaveInput(BaseModel):
    channels: List[Dict[str, Any]]
    raw_search_results: Optional[Dict[str, Any]] = None
    search_metadata: Optional[Dict[str, Any]] = None

@api_router.post("/search-results/autosave")
async def autosave_search_results(input: AutoSaveInput, user=Depends(get_current_user)):
    """Auto-save current search results (upserts a single auto-save per user)"""
    doc = {
        "user_id": user["id"],
        "channels": input.channels,
        "raw_search_results": input.raw_search_results,
        "search_metadata": input.search_metadata,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "is_autosave": True
    }
    await db.autosaved_results.update_one(
        {"user_id": user["id"]},
        {"$set": doc},
        upsert=True
    )
    return {"success": True}

@api_router.get("/search-results/autosave")
async def get_autosaved_results(user=Depends(get_current_user)):
    """Get auto-saved search results for current user"""
    result = await db.autosaved_results.find_one({"user_id": user["id"]}, {"_id": 0})
    if not result:
        return {"exists": False}
    return {"exists": True, **result}

@api_router.delete("/search-results/autosave")
async def delete_autosaved_results(user=Depends(get_current_user)):
    """Delete auto-saved search results"""
    await db.autosaved_results.delete_one({"user_id": user["id"]})
    return {"success": True}

# Search History endpoints
@api_router.post("/search-history")
async def save_search_history(input: SaveSearchInput, user=Depends(get_current_user)):
    """Save a search to history"""
    # Check tier permissions
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    if not tier_config["saved_searches"]:
        return JSONResponse(status_code=403, content={"error": "upgrade_required", "message": "This feature requires a Starter or Pro plan", "upgrade_url": "/pricing"})
    
    item = SearchHistoryItem(
        name=input.name,
        keywords=input.keywords,
        filters=input.filters,
        results_count=input.results_count
    )
    doc = item.model_dump()
    doc["user_id"] = user["id"]
    await db.search_history.insert_one(doc)
    return {"success": True, "id": item.id}

@api_router.get("/search-history")
async def get_search_history(user=Depends(get_current_user)):
    """Get all saved searches"""
    items = await db.search_history.find({"user_id": user["id"]}, {"_id": 0}).sort("last_used_at", -1).to_list(50)
    return {"searches": items}

@api_router.delete("/search-history/{search_id}")
async def delete_search_history(search_id: str, user=Depends(get_current_user)):
    """Delete a saved search"""
    await db.search_history.delete_one({"id": search_id, "user_id": user["id"]})
    return {"success": True}

@api_router.put("/search-history/{search_id}/use")
async def mark_search_used(search_id: str, results_count: Optional[int] = None, user=Depends(get_current_user)):
    """Mark a search as used and update last_used_at"""
    update_data = {"last_used_at": datetime.now(timezone.utc).isoformat()}
    if results_count is not None:
        update_data["results_count"] = results_count
    await db.search_history.update_one(
        {"id": search_id, "user_id": user["id"]},
        {"$set": update_data}
    )
    return {"success": True}

# Search Reports endpoints (full results storage)
@api_router.post("/search-reports")
async def save_search_report(input: SaveReportInput, user=Depends(get_current_user)):
    """Save a complete search report with all results"""
    # Check tier permissions
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    if not tier_config["saved_reports"]:
        return JSONResponse(status_code=403, content={"error": "upgrade_required", "message": "This feature requires a Starter or Pro plan", "upgrade_url": "/pricing"})
    
    report = SearchReport(
        name=input.name,
        keywords=input.keywords,
        filters=input.filters,
        channels=input.channels,
        shortlisted_ids=input.shortlisted_ids,
        channels_count=len(input.channels)
    )
    doc = report.model_dump()
    doc["user_id"] = user["id"]
    await db.search_reports.insert_one(doc)
    return {"success": True, "id": report.id}

@api_router.get("/search-reports")
async def get_search_reports(user=Depends(get_current_user)):
    """Get all saved reports (without full channel data for performance)"""
    items = await db.search_reports.find(
        {"user_id": user["id"]}, 
        {"_id": 0, "channels": 0}
    ).sort("created_at", -1).to_list(50)
    return {"reports": items}

@api_router.get("/search-reports/{report_id}")
async def get_search_report(report_id: str, user=Depends(get_current_user)):
    """Get a specific report with full channel data"""
    report = await db.search_reports.find_one({"id": report_id, "user_id": user["id"]}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@api_router.delete("/search-reports/{report_id}")
async def delete_search_report(report_id: str, user=Depends(get_current_user)):
    """Delete a saved report"""
    await db.search_reports.delete_one({"id": report_id, "user_id": user["id"]})
    return {"success": True}

# CSV Export endpoint
@api_router.post("/export/csv")
async def export_csv(channel_ids: List[str], user=Depends(get_current_user)):
    """Export channels to CSV"""
    # Check tier permissions
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    if not tier_config["csv_export"]:
        return JSONResponse(status_code=403, content={"error": "upgrade_required", "message": "This feature requires a Starter or Pro plan", "upgrade_url": "/pricing"})
    # Block trial users from export
    if user.get("is_trial"):
        return JSONResponse(status_code=403, content={"error": "upgrade_required", "message": "Export is not available during your trial. Upgrade to a paid plan to export your data.", "upgrade_url": "/pricing"})
    
    channels = await db.channels.find(
        {"channel_id": {"$in": channel_ids}, "user_id": user["id"]},
        {"_id": 0}
    ).to_list(1000)
    
    if not channels:
        raise HTTPException(status_code=404, detail="No channels found")
    
    # Create CSV
    output = io.StringIO()
    fieldnames = [
        "channel_name", "channel_url", "channel_id", "subscriber_count",
        "hidden_subscriber_count", "video_count", "avg_views_recent",
        "latest_upload_date", "days_since_upload", "description",
        "keywords_found_by", "search_source", "topic_tags", "score_total",
        "score_topic", "score_tutorial", "score_activity", "score_subscriber",
        "score_engagement", "score_contactability", "website", "instagram",
        "twitter", "linkedin", "notes",
        # New affiliate detection fields
        "latest_video_titles", "affiliate_signals", "affiliate_signals_count",
        "commercial_signals", "commercial_signals_count", "affiliate_score",
        "has_affiliate_language", "does_reviews", "has_link_in_bio", "product_monetization",
        # Brand contact signals
        "brand_contact_signals", "brand_contact_signals_count", "has_business_email", "business_email",
        # Affiliate platform links
        "affiliate_platforms_found", "affiliate_platforms_count", "affiliate_platform_links",
        "affiliate_links_total",
        # Tool Stack Detection
        "tools_section_detected", "tools_stack_signal_score",
        # Channel Health Indicators
        "upload_consistency", "upload_avg_days", "engagement_health", "engagement_rate", "growth_indicator",
        # Geography
        "country", "country_name"
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for ch in channels:
        row = {
            "channel_name": ch.get("channel_name", ""),
            "channel_url": ch.get("channel_url", ""),
            "channel_id": ch.get("channel_id", ""),
            "subscriber_count": ch.get("subscriber_count", 0),
            "hidden_subscriber_count": ch.get("hidden_subscriber_count", False),
            "video_count": ch.get("video_count", 0),
            "avg_views_recent": ch.get("avg_views_recent", 0),
            "latest_upload_date": ch.get("latest_upload_date", ""),
            "days_since_upload": ch.get("days_since_upload", ""),
            "description": ch.get("description", "")[:500],  # Truncate long descriptions
            "keywords_found_by": ", ".join(ch.get("keywords_found_by", [])),
            "search_source": ch.get("search_source", ""),
            "topic_tags": ", ".join(ch.get("topic_tags", [])),
            "score_total": ch.get("score_total", 0),
            "score_topic": ch.get("score_topic", 0),
            "score_tutorial": ch.get("score_tutorial", 0),
            "score_activity": ch.get("score_activity", 0),
            "score_subscriber": ch.get("score_subscriber", 0),
            "score_engagement": ch.get("score_engagement", 0),
            "score_contactability": ch.get("score_contactability", 0),
            "website": ch.get("public_links", {}).get("website", ""),
            "instagram": ch.get("public_links", {}).get("instagram", ""),
            "twitter": ch.get("public_links", {}).get("twitter", ""),
            "linkedin": ch.get("public_links", {}).get("linkedin", ""),
            "notes": ch.get("notes", ""),
            # New affiliate detection fields
            "latest_video_titles": ch.get("latest_video_titles", ""),
            "affiliate_signals": ", ".join(ch.get("affiliate_signals", [])),
            "affiliate_signals_count": ch.get("affiliate_signals_count", 0),
            "commercial_signals": ", ".join(ch.get("commercial_signals", [])),
            "commercial_signals_count": ch.get("commercial_signals_count", 0),
            "affiliate_score": ch.get("affiliate_score", 0),
            "has_affiliate_language": ch.get("has_affiliate_language", False),
            "does_reviews": ch.get("does_reviews", False),
            "has_link_in_bio": ch.get("has_link_in_bio", False),
            "product_monetization": ch.get("product_monetization", False),
            # Brand contact signals
            "brand_contact_signals": ", ".join(ch.get("brand_contact_signals", [])),
            "brand_contact_signals_count": ch.get("brand_contact_signals_count", 0),
            "has_business_email": ch.get("has_business_email", False),
            "business_email": ch.get("business_email", ""),
            # Affiliate platform links
            "affiliate_platforms_found": ", ".join(ch.get("affiliate_platforms_found", [])),
            "affiliate_platforms_count": ch.get("affiliate_platforms_count", 0),
            "affiliate_platform_links": str(ch.get("affiliate_platform_links", {})),
            # Tool Stack Detection
            "tools_section_detected": ch.get("tools_section_detected", False),
            "tools_stack_signal_score": ch.get("tools_stack_signal_score", 0),
            # Channel Health Indicators
            "upload_consistency": ch.get("upload_consistency", ""),
            "upload_avg_days": ch.get("upload_avg_days", ""),
            "engagement_health": ch.get("engagement_health", ""),
            "engagement_rate": ch.get("engagement_rate", ""),
            "growth_indicator": ch.get("growth_indicator", ""),
            # Geography
            "country": ch.get("country", ""),
            "country_name": ch.get("country_name", "")
        }
        writer.writerow(row)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=affilitube_prospects_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

class CheckoutRequest(BaseModel):
    plan: str = "pro_monthly"
    endorsely_referral: Optional[str] = None

# ==================== ADMIN ENDPOINTS ====================

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user and verify admin role"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@api_router.get("/admin/overview")
async def admin_overview(admin=Depends(get_admin_user)):
    """Get admin dashboard overview stats"""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # User counts by tier
    total_users = await db.users.count_documents({})
    free_users = await db.users.count_documents({"tier": "free"})
    starter_users = await db.users.count_documents({"tier": "starter"})
    pro_users = await db.users.count_documents({"tier": "pro"})
    appsumo_users = await db.users.count_documents({"tier": "appsumo"})
    # Count users without tier field as free
    no_tier_users = await db.users.count_documents({"tier": {"$exists": False}})
    free_users += no_tier_users
    
    # Search counts
    searches_today = await db.search_activity.count_documents({"timestamp": {"$gte": today_start}})
    searches_week = await db.search_activity.count_documents({"timestamp": {"$gte": week_ago}})
    searches_month = await db.search_activity.count_documents({"timestamp": {"$gte": month_ago}})
    
    # API quota usage today (across all users)
    today_pacific = await get_today_pacific()
    quota_docs = await db.quota_usage.find({"date": today_pacific}).to_list(1000)
    total_quota_used = sum(doc.get("total_units", 0) for doc in quota_docs)
    
    # New signups in last 7 days
    new_signups = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    
    # Revenue estimate
    monthly_revenue = (starter_users * 40) + (pro_users * 79)
    
    return {
        "users": {
            "total": total_users,
            "free": free_users,
            "starter": starter_users,
            "pro": pro_users,
            "appsumo": appsumo_users,
        },
        "searches": {
            "today": searches_today,
            "this_week": searches_week,
            "this_month": searches_month,
        },
        "quota": {
            "used_today": total_quota_used,
            "daily_limit": 10000,
            "percentage": round((total_quota_used / 10000) * 100, 1) if total_quota_used else 0,
        },
        "new_signups_7d": new_signups,
        "revenue": {
            "monthly_estimate": monthly_revenue,
            "starter_subscribers": starter_users,
            "pro_subscribers": pro_users,
        }
    }

class UpdateUserTierRequest(BaseModel):
    tier: str

@api_router.get("/admin/users")
async def admin_list_users(
    search: str = Query(default="", description="Search by email"),
    tier_filter: str = Query(default="", description="Filter by tier"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=100),
    admin=Depends(get_admin_user)
):
    """List all users with filtering"""
    query = {}
    
    if search:
        query["email"] = {"$regex": search, "$options": "i"}
    
    if tier_filter and tier_filter != "all":
        query["tier"] = tier_filter
    
    # Get users
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    # Enrich with search stats
    enriched_users = []
    for user in users:
        user_id = user.get("id")
        
        # Total searches all time
        total_searches = await db.search_activity.count_documents({"user_id": user_id})
        
        # Last activity (most recent search)
        last_search = await db.search_activity.find_one(
            {"user_id": user_id}, 
            sort=[("timestamp", -1)]
        )
        last_active = last_search.get("timestamp") if last_search else user.get("created_at")
        
        enriched_users.append({
            **user,
            "tier": user.get("tier", "free"),
            "searches_this_month": user.get("monthly_search_count", 0),
            "total_searches": total_searches,
            "last_active": last_active,
        })
    
    return {
        "users": enriched_users,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@api_router.put("/admin/users/{user_id}/tier")
async def admin_update_user_tier(user_id: str, data: UpdateUserTierRequest, admin=Depends(get_admin_user)):
    """Update a user's tier"""
    if data.tier not in ["free", "starter", "pro", "appsumo"]:
        raise HTTPException(status_code=400, detail="Invalid tier. Must be free, starter, pro, or appsumo")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"tier": data.tier, "has_paid": data.tier in ["pro", "appsumo"]}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": f"User tier updated to {data.tier}"}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin=Depends(get_admin_user)):
    """Delete a user and their associated data"""
    # Don't allow deleting yourself
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user and associated data
    await db.users.delete_one({"id": user_id})
    await db.search_activity.delete_many({"user_id": user_id})
    await db.channels.delete_many({"user_id": user_id})
    await db.shortlist.delete_many({"user_id": user_id})
    await db.search_history.delete_many({"user_id": user_id})
    await db.search_reports.delete_many({"user_id": user_id})
    await db.quota_usage.delete_many({"user_id": user_id})
    
    return {"success": True, "message": f"User {user['email']} deleted"}

class AdminCreateUserInput(BaseModel):
    email: str
    password: str
    tier: str = "free"
    draft_credits: int = 0
    access_expires_at: Optional[str] = None

@api_router.post("/admin/users")
async def admin_create_user(data: AdminCreateUserInput, admin=Depends(get_admin_user)):
    """Admin: manually create a user with a specific tier and optional expiry"""
    email = data.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if data.tier not in ("free", "starter", "pro"):
        raise HTTPException(status_code=400, detail="Tier must be free, starter, or pro")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed_password = await _hash_password(data.password)
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hashed_password,
        "role": "user",
        "tier": data.tier,
        "monthly_search_count": 0,
        "search_count_reset_date": datetime.now(timezone.utc).strftime("%Y-%m"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "draft_credits": data.draft_credits,
    }
    if data.access_expires_at:
        user_doc["access_expires_at"] = data.access_expires_at
    
    await db.users.insert_one(user_doc)
    return {"success": True, "user_id": user_id, "email": email, "tier": data.tier}

class AdminUpdateExpiryInput(BaseModel):
    access_expires_at: Optional[str] = None

@api_router.put("/admin/users/{user_id}/expiry")
async def admin_update_expiry(user_id: str, data: AdminUpdateExpiryInput, admin=Depends(get_admin_user)):
    """Admin: set or clear access expiry for a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.access_expires_at:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"access_expires_at": data.access_expires_at, "access_expired": False}}
        )
    else:
        await db.users.update_one(
            {"id": user_id},
            {"$unset": {"access_expires_at": "", "access_expired": ""}}
        )
    
    return {"success": True}


class AdminGrantCreditsInput(BaseModel):
    credits: int = Field(..., gt=0, le=10000)

@api_router.put("/admin/users/{user_id}/credits")
async def admin_grant_credits(user_id: str, input: AdminGrantCreditsInput, admin=Depends(get_admin_user)):
    """Grant AI draft credits to a user"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"draft_credits": input.credits}}
    )
    new_balance = (await db.users.find_one({"id": user_id}, {"_id": 0, "draft_credits": 1})).get("draft_credits", 0)
    return {"success": True, "credits_added": input.credits, "new_balance": new_balance, "email": user["email"]}

@api_router.get("/admin/competitor-brands")
async def get_competitor_brands(admin=Depends(get_admin_user)):
    """Get admin's competitor brand list"""
    admin_data = await db.users.find_one({"id": admin["id"]}, {"_id": 0, "competitor_brands": 1})
    return {"competitor_brands": (admin_data or {}).get("competitor_brands", [])}

class CompetitorBrandsInput(BaseModel):
    competitor_brands: List[str] = []

@api_router.put("/admin/competitor-brands")
async def update_competitor_brands(data: CompetitorBrandsInput, admin=Depends(get_admin_user)):
    """Save admin's competitor brand list"""
    brands = [b.strip() for b in data.competitor_brands if b.strip()]
    await db.users.update_one({"id": admin["id"]}, {"$set": {"competitor_brands": brands}})
    return {"success": True, "competitor_brands": brands}




@api_router.post("/admin/clear-enrichment-cache")
async def admin_clear_enrichment_cache(admin=Depends(get_admin_user)):
    """Clear all cached enrichment and sponsorship data to force fresh re-scans"""
    r1 = await db.channels.update_many(
        {"enriched_at": {"$exists": True}},
        {"$unset": {"enriched_at": ""}}
    )
    r2 = await db.channels.update_many(
        {"sponsorship_data": {"$exists": True}},
        {"$unset": {"sponsorship_data": "", "last_sponsorship_check": ""}}
    )
    r3 = await db.autosaved_results.delete_many({})
    return {
        "success": True,
        "enrichment_cleared": r1.modified_count,
        "sponsorship_cleared": r2.modified_count,
        "autosave_cleared": r3.deleted_count,
    }


@api_router.get("/admin/quota")
async def admin_quota_monitor(admin=Depends(get_admin_user)):
    """Get detailed quota usage for admin monitoring"""
    today_pacific = await get_today_pacific()
    
    # Get all quota usage for today
    quota_docs = await db.quota_usage.find({"date": today_pacific}).to_list(1000)
    
    # Aggregate totals
    totals = {
        "search_calls": 0,
        "channel_calls": 0,
        "playlist_calls": 0,
        "video_calls": 0,
        "total_units": 0,
    }
    
    user_usage = []
    for doc in quota_docs:
        totals["search_calls"] += doc.get("search_calls", 0)
        totals["channel_calls"] += doc.get("channel_calls", 0)
        totals["playlist_calls"] += doc.get("playlist_calls", 0)
        totals["video_calls"] += doc.get("video_calls", 0)
        totals["total_units"] += doc.get("total_units", 0)
        
        if doc.get("user_id"):
            user = await db.users.find_one({"id": doc["user_id"]}, {"email": 1})
            user_usage.append({
                "user_id": doc.get("user_id"),
                "user_email": user.get("email") if user else "Unknown",
                "total_units": doc.get("total_units", 0),
                "search_calls": doc.get("search_calls", 0),
                "channel_calls": doc.get("channel_calls", 0),
            })
    
    # Sort by usage
    user_usage.sort(key=lambda x: x["total_units"], reverse=True)
    
    # Get hourly breakdown from search activity
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    hourly_data = []
    for hour in range(24):
        hour_start = (today_start + timedelta(hours=hour)).isoformat()
        hour_end = (today_start + timedelta(hours=hour + 1)).isoformat()
        
        count = await db.search_activity.count_documents({
            "timestamp": {"$gte": hour_start, "$lt": hour_end}
        })
        hourly_data.append({
            "hour": hour,
            "searches": count,
        })
    
    return {
        "date": today_pacific,
        "totals": totals,
        "daily_limit": 10000,
        "percentage_used": round((totals["total_units"] / 10000) * 100, 1),
        "top_users": user_usage[:10],
        "hourly_searches": hourly_data,
    }

@api_router.get("/admin/search-activity")
async def admin_search_activity(
    limit: int = Query(default=100, le=500),
    admin=Depends(get_admin_user)
):
    """Get recent search activity log"""
    searches = await db.search_activity.find(
        {}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"searches": searches, "total": len(searches)}

@api_router.get("/admin/revenue")
async def admin_revenue(admin=Depends(get_admin_user)):
    """Get revenue overview"""
    # Get all paid users
    paid_users = await db.users.find(
        {"tier": {"$in": ["pro", "appsumo"]}},
        {"_id": 0, "password_hash": 0}
    ).sort("paid_at", -1).to_list(1000)
    
    # Calculate MRR
    pro_monthly = 0
    pro_yearly = 0
    appsumo = 0
    
    for user in paid_users:
        tier = user.get("tier")
        plan = user.get("subscription_plan", "pro_monthly")
        
        if tier == "pro":
            if plan == "pro_yearly":
                pro_yearly += 1
            else:
                pro_monthly += 1
        elif tier == "appsumo":
            appsumo += 1
    
    # MRR calculation
    # Monthly: $39/mo, Yearly: $299/yr = ~$25/mo
    mrr = (pro_monthly * 39) + (pro_yearly * 25)
    
    # Get payment transactions
    transactions = await db.payment_transactions.find(
        {"payment_status": "paid"},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "subscribers": {
            "pro_monthly": pro_monthly,
            "pro_yearly": pro_yearly,
            "appsumo": appsumo,
            "total": pro_monthly + pro_yearly + appsumo,
        },
        "mrr": mrr,
        "arr": mrr * 12,
        "paid_users": [{
            "email": u.get("email"),
            "tier": u.get("tier"),
            "plan": u.get("subscription_plan", "pro_monthly"),
            "paid_at": u.get("paid_at"),
            "created_at": u.get("created_at"),
        } for u in paid_users],
        "recent_transactions": transactions,
    }

@api_router.get("/admin/partner-applications")
async def admin_partner_applications(
    limit: int = Query(default=200, le=1000),
    admin=Depends(get_admin_user),
):
    """List Partner Program applications (newest first)."""
    apps = await db.partner_applications.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"applications": apps, "total": len(apps)}

@api_router.delete("/admin/partner-applications/{application_id}")
async def admin_delete_partner_application(application_id: str, admin=Depends(get_admin_user)):
    """Delete a Partner Program application."""
    res = await db.partner_applications.delete_one({"id": application_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True}

# ==================== STRIPE CHECKOUT ====================

import stripe as stripe_sdk

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")

# Read price IDs from environment
STRIPE_PRICE_IDS = {
    "starter_monthly": os.environ.get("STRIPE_STARTER_MONTHLY_PRICE_ID"),
    "starter_annual": os.environ.get("STRIPE_STARTER_ANNUAL_PRICE_ID"),
    "pro_monthly": os.environ.get("STRIPE_PRO_MONTHLY_PRICE_ID"),
    "pro_annual": os.environ.get("STRIPE_PRO_ANNUAL_PRICE_ID"),
}

# Reverse map: price_id -> tier
PRICE_ID_TO_TIER = {}
for plan_key, pid in STRIPE_PRICE_IDS.items():
    if pid:
        PRICE_ID_TO_TIER[pid] = "starter" if plan_key.startswith("starter") else "pro"

def get_tier_for_plan(plan: str) -> str:
    """Determine which tier a plan belongs to"""
    if plan.startswith("starter"):
        return "starter"
    return "pro"

def get_tier_for_price_id(price_id: str) -> str:
    """Determine which tier a Stripe price ID maps to"""
    return PRICE_ID_TO_TIER.get(price_id, "pro")

@api_router.post("/checkout/create-session")
async def create_checkout_session(data: CheckoutRequest, request: Request, user=Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Get price ID for selected plan
    price_id = STRIPE_PRICE_IDS.get(data.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan selected")

    # Check if user already has the target tier or higher
    tier = get_user_tier(user)
    target_tier = get_tier_for_plan(data.plan)
    if tier in ["pro", "appsumo"]:
        raise HTTPException(status_code=400, detail="You already have Pro access")
    if tier == "starter" and target_tier == "starter":
        raise HTTPException(status_code=400, detail="You already have Starter access. Upgrade to Pro instead.")

    stripe_sdk.api_key = STRIPE_API_KEY
    # Build origin from forwarded headers (Kubernetes ingress) for correct redirect URLs
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    origin = request.headers.get("origin") or f"{proto}://{host}".rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"
    
    try:
        session = stripe_sdk.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user["email"],
            metadata={
                "user_id": user["id"],
                "user_email": user["email"],
                "product": f"affilitube_{data.plan}",
                "plan": data.plan,
                **({"endorsely_referral": data.endorsely_referral} if data.endorsely_referral else {}),
            },
        )
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")

    # Record pending transaction
    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "user_id": user["id"],
        "user_email": user["email"],
        "stripe_price_id": price_id,
        "plan": data.plan,
        "payment_status": "pending",
        "product": f"affilitube_{data.plan}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request, user=Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Session not found")

    stripe_sdk.api_key = STRIPE_API_KEY
    try:
        session = stripe_sdk.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not retrieve session: {e}")

    new_status = session.payment_status or session.status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "stripe_customer_id": session.customer,
            "stripe_subscription_id": session.subscription,
        }}
    )

    if new_status == "paid":
        assigned_tier = get_tier_for_plan(txn.get("plan", "pro_monthly"))
        update_fields = {
            "tier": assigned_tier, 
            "has_paid": True,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "subscription_plan": txn.get("plan", "pro_monthly"),
        }
        if session.customer:
            update_fields["stripe_customer_id"] = session.customer
        if session.subscription:
            update_fields["stripe_subscription_id"] = session.subscription
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": update_fields}
        )

    return {
        "status": session.status,
        "payment_status": new_status,
        "plan": txn.get("plan", ""),
        "tier": get_tier_for_plan(txn.get("plan", "")) if new_status == "paid" else None,
        "amount_total": session.amount_total,
        "currency": session.currency,
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Verify webhook signature
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe_sdk.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
        else:
            import json as json_lib
            event = json_lib.loads(body)
    except Exception as e:
        logger.error(f"Stripe signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event.get("type", "") if isinstance(event, dict) else event.type
    data_obj = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object

    if event_type == "checkout.session.completed":
        session_id = data_obj.get("id") if isinstance(data_obj, dict) else data_obj.id
        customer_id = data_obj.get("customer") if isinstance(data_obj, dict) else data_obj.customer
        subscription_id = data_obj.get("subscription") if isinstance(data_obj, dict) else data_obj.subscription
        metadata = data_obj.get("metadata", {}) if isinstance(data_obj, dict) else (data_obj.metadata or {})
        
        # Handle AI draft credit purchase
        if metadata.get("product") == "ai_draft_credits":
            user_id = metadata.get("user_id")
            credits_amount = int(metadata.get("credits_amount", 500))
            if user_id:
                await db.users.update_one(
                    {"id": user_id},
                    {"$inc": {"draft_credits": credits_amount}}
                )
                logger.info(f"Credits purchased: user={user_id}, credits={credits_amount}")
            return {"status": "ok"}

        txn = await db.payment_transactions.find_one({"session_id": session_id})
        if txn and txn.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                }}
            )
            user_id = metadata.get("user_id") or txn.get("user_id")
            plan = metadata.get("plan") or txn.get("plan", "pro_monthly")
            if user_id:
                assigned_tier = get_tier_for_plan(plan)
                update_fields = {
                    "tier": assigned_tier, 
                    "has_paid": True,
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "subscription_plan": plan,
                }
                if customer_id:
                    update_fields["stripe_customer_id"] = customer_id
                if subscription_id:
                    update_fields["stripe_subscription_id"] = subscription_id
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": update_fields}
                )
                logger.info(f"Checkout completed: user={user_id}, tier={assigned_tier}")

    elif event_type == "customer.subscription.updated":
        items_data = data_obj.get("items", {}).get("data", []) if isinstance(data_obj, dict) else (data_obj.get("items", {}).get("data", []) if hasattr(data_obj, "get") else [])
        if items_data:
            price_obj = items_data[0].get("price", {}) if isinstance(items_data[0], dict) else items_data[0].price
            new_price_id = price_obj.get("id", "") if isinstance(price_obj, dict) else price_obj.id
            new_tier = get_tier_for_price_id(new_price_id)
            customer_id = data_obj.get("customer") if isinstance(data_obj, dict) else data_obj.customer
            if customer_id:
                user = await db.users.find_one({"stripe_customer_id": customer_id})
                if user:
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"tier": new_tier, "subscription_plan": f"{new_tier}_subscription"}}
                    )
                    logger.info(f"Subscription updated for {user['email']}: tier={new_tier}")

    elif event_type == "customer.subscription.deleted":
        customer_id = data_obj.get("customer") if isinstance(data_obj, dict) else data_obj.customer
        if customer_id:
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            if user:
                grace_until = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"subscription_cancelled": True, "grace_period_until": grace_until}}
                )
                logger.info(f"Subscription cancelled for {user['email']}, grace until {grace_until}")

    elif event_type == "invoice.payment_failed":
        customer_id = data_obj.get("customer") if isinstance(data_obj, dict) else data_obj.customer
        if customer_id:
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            await db.payment_events.insert_one({
                "event_type": "payment_failed",
                "customer_id": customer_id,
                "user_email": user.get("email") if user else None,
                "user_id": user.get("id") if user else None,
                "invoice_id": data_obj.get("id") if isinstance(data_obj, dict) else data_obj.id,
                "amount_due": data_obj.get("amount_due") if isinstance(data_obj, dict) else data_obj.amount_due,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            if user:
                grace_until = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {"payment_failed": True, "grace_period_until": grace_until}}
                )
                logger.warning(f"Payment failed for {user['email']}, grace until {grace_until}")

    elif event_type == "invoice.payment_succeeded":
        customer_id = data_obj.get("customer") if isinstance(data_obj, dict) else data_obj.customer
        if customer_id:
            user = await db.users.find_one({"stripe_customer_id": customer_id})
            if user:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$unset": {"payment_failed": "", "grace_period_until": "", "subscription_cancelled": ""}}
                )

    return {"status": "ok"}

@api_router.post("/billing/portal-session")
async def create_billing_portal_session(request: Request, user=Depends(get_current_user)):
    """Create a Stripe customer portal session for subscription management"""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    tier = get_user_tier(user)
    if tier not in ["starter", "pro"]:
        raise HTTPException(status_code=400, detail="No active subscription to manage")
    
    user_data = await db.users.find_one({"id": user["id"]})
    customer_id = user_data.get("stripe_customer_id") if user_data else None
    
    if not customer_id:
        # Look up customer by email in Stripe
        stripe_sdk.api_key = STRIPE_API_KEY
        customers = stripe_sdk.Customer.list(email=user["email"], limit=1)
        if customers.data:
            customer_id = customers.data[0].id
            await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_customer_id": customer_id}})
        else:
            raise HTTPException(status_code=404, detail="No Stripe customer found. Please contact support.")
    
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    stripe_sdk.api_key = STRIPE_API_KEY
    portal_session = stripe_sdk.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{origin}/dashboard",
    )
    
    return {"url": portal_session.url}

# Include the router in the main app
app.include_router(api_router)

# SaaS Radar (admin-only ProductHunt prospecting module)
from saas_radar import build_router as _build_saas_radar_router
app.include_router(
    _build_saas_radar_router(db, get_admin_user),
    prefix="/api",
)


# --------------------------------------------------------------------------
# Kubernetes liveness/readiness probe endpoint.
# --------------------------------------------------------------------------
# Emergent's K8s probes hit GET /health on localhost:8001 directly (bypassing
# the ingress and therefore the /api prefix). Without this route, every probe
# 404s, the pod is marked unhealthy, and Kubernetes tears it down mid-boot —
# which manifests as a failed deployment. This handler responds fast and
# does NOT touch MongoDB so a transient DB blip cannot fail liveness.
@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# --------------------------------------------------------------------------
# YouTube API quota diagnostic — admin-only.
# --------------------------------------------------------------------------
# Reports today's + trailing-N-day YouTube API consumption split by which key
# (admin vs regular) burned the units, and by operation (search / channels /
# playlistItems / videos). Data source is the yt_quota_usage collection
# populated fire-and-forget by _yt_execute() on every YouTube API call.
# Use this to spot quota leaks (e.g. an admin flow accidentally burning regular
# user quota) before either key hits its 10k daily unit cap.
@app.get("/api/admin/quota-status")
async def quota_status(days: int = 7, admin=Depends(get_admin_user)):
    days = max(1, min(days, 30))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor = db.yt_quota_usage.find(
        {"date": {"$gte": cutoff}},
        projection={"_id": 0},
    ).sort([("date", -1), ("key", 1), ("operation", 1)])
    rows = await cursor.to_list(length=2000)

    def _tally(filter_fn):
        u = sum(r.get("units", 0) for r in rows if filter_fn(r))
        c = sum(r.get("calls", 0) for r in rows if filter_fn(r))
        return {"units": u, "calls": c}

    today_admin = _tally(lambda r: r["date"] == today and r["key"] == "admin")
    today_regular = _tally(lambda r: r["date"] == today and r["key"] == "regular")
    window_admin = _tally(lambda r: r["key"] == "admin")
    window_regular = _tally(lambda r: r["key"] == "regular")

    def _pct(units):
        return round(100 * units / _YT_DAILY_QUOTA_LIMIT, 1) if _YT_DAILY_QUOTA_LIMIT else None

    return {
        "today": today,
        "daily_limit_units": _YT_DAILY_QUOTA_LIMIT,
        "today_admin": {**today_admin, "pct_of_limit": _pct(today_admin["units"])},
        "today_regular": {**today_regular, "pct_of_limit": _pct(today_regular["units"])},
        "window_days": days,
        "window_admin": window_admin,
        "window_regular": window_regular,
        "rows": rows,
    }

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def seed_admin():
    """Ensure adrian@affilitube.com exists and has role=admin. Idempotent.

    Production history:
      - Original deploys seeded admin@affilitube.com (wrong inbox).
      - User signed up separately with adrian@affilitube.com (role=user).
      - Earlier migration attempted to rename admin@ -> adrian@ but skipped when both existed,
        leaving adrian@ stuck on role=user. This version actively reconciles either case.
    """
    ADMIN_EMAIL = "adrian@affilitube.com"
    LEGACY_EMAIL = "admin@affilitube.com"

    adrian = await db.users.find_one({"email": ADMIN_EMAIL})
    legacy = await db.users.find_one({"email": LEGACY_EMAIL})

    if adrian and legacy:
        # Both exist (most common production case): promote adrian to admin,
        # carry forward any pro-tier flags from the legacy account, then delete legacy.
        promote = {
            "role": "admin",
            "tier": "pro",
            "role_promoted_at": datetime.now(timezone.utc).isoformat(),
        }
        # Preserve adrian's account; only set fields that aren't already pro/admin.
        await db.users.update_one({"id": adrian["id"]}, {"$set": promote})
        await db.users.delete_one({"id": legacy["id"]})
        logger.info(
            f"Admin reconciliation: promoted {ADMIN_EMAIL} to role=admin and removed legacy {LEGACY_EMAIL}."
        )
        return

    if adrian and not legacy:
        # Only adrian exists. Make sure they're admin.
        if adrian.get("role") != "admin":
            await db.users.update_one(
                {"id": adrian["id"]},
                {"$set": {
                    "role": "admin",
                    "tier": "pro",
                    "role_promoted_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            logger.info(f"Admin reconciliation: promoted existing {ADMIN_EMAIL} to role=admin.")
        return

    if legacy and not adrian:
        # Only the legacy seed exists. Rename it.
        await db.users.update_one(
            {"id": legacy["id"]},
            {"$set": {
                "email": ADMIN_EMAIL,
                "role": "admin",
                "email_updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        logger.info(f"Admin reconciliation: renamed legacy {LEGACY_EMAIL} -> {ADMIN_EMAIL}.")
        return

    # Neither exists: create fresh admin.
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL,
        "password_hash": pwd_context.hash("admin123!"),
        "role": "admin",
        "tier": "pro",
        "monthly_search_count": 0,
        "search_count_reset_date": datetime.now(timezone.utc).strftime("%Y-%m"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(admin_user)
    logger.info(f"Admin reconciliation: seeded fresh admin {ADMIN_EMAIL}.")

@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        from saas_radar import _shutdown_playwright
        await _shutdown_playwright()
    except Exception:
        pass
    if _saas_radar_scheduler is not None:
        _saas_radar_scheduler.shutdown(wait=False)
    client.close()


# ============================================================================
# SaaS Radar: daily auto-ingest scheduler (9am UTC)
# ============================================================================
_saas_radar_scheduler = None


@app.on_event("startup")
async def _start_saas_radar_scheduler():
    """Schedules a daily ingest of the previous 2 days at 09:00 UTC, plus an
    auto-enrich of up to 200 newly ingested products. Idempotent — re-running
    a daily ingest just upserts existing products."""
    global _saas_radar_scheduler
    if os.environ.get("DISABLE_SAAS_RADAR_CRON", "").lower() in ("1", "true", "yes"):
        logger.info("SaaS Radar cron disabled via env DISABLE_SAAS_RADAR_CRON")
        return
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from saas_radar import _bg_ingest, _bg_enrich, _create_job, DEFAULT_SAAS_TOPICS, PH_TOKEN, start_radar_worker

        async def _daily_run():
            if not PH_TOKEN:
                logger.warning("SaaS Radar daily cron skipped: PRODUCTHUNT_TOKEN not configured.")
                return
            try:
                logger.info("SaaS Radar daily cron: scheduling ingest+enrich on dedicated worker thread")
                ingest_job_id = await _create_job(db, "ingest", {"days_back": 2, "topics": DEFAULT_SAAS_TOPICS, "source": "cron"})
                enrich_job_id = await _create_job(db, "enrich", {"limit": 200, "use_llm": False, "use_playwright": False, "source": "cron"})

                # Run ingest + enrich sequentially on ONE worker thread so the API
                # event loop stays untouched. Without this, the daily cron would
                # block the loop for 5-15 minutes and freeze user-facing requests.
                async def _seq(worker_db):
                    await _bg_ingest(worker_db, 2, DEFAULT_SAAS_TOPICS, ingest_job_id)
                    await _bg_enrich(worker_db, 200, False, False, enrich_job_id)
                    logger.info("SaaS Radar daily cron: complete")

                start_radar_worker(_seq, label="daily-cron ingest+enrich")
            except Exception as e:
                logger.exception("SaaS Radar daily cron failed: %s", e)

        _saas_radar_scheduler = AsyncIOScheduler(timezone="UTC")
        _saas_radar_scheduler.add_job(
            _daily_run,
            CronTrigger(hour=9, minute=0, timezone="UTC"),
            id="saas_radar_daily",
            max_instances=1,
            coalesce=True,
        )
        _saas_radar_scheduler.start()
        logger.info("SaaS Radar daily cron scheduled for 09:00 UTC")
    except Exception as e:
        logger.exception("Failed to start SaaS Radar scheduler: %s", e)
