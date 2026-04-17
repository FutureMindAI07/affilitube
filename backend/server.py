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
import io
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'affilitube_db')]

# Auth config
JWT_SECRET = os.environ.get("JWT_SECRET", str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

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
        "searches_per_month": None,  # Unlimited
        "max_results_per_search": None,  # No limit
        "csv_export": True,
        "saved_searches": True,
        "saved_reports": True,
        "pipeline_access": True,
        "max_pipeline_projects": None  # Unlimited
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
    tier = get_user_tier(user)
    tier_config = get_tier_config(tier)
    
    # Pro and AppSumo have unlimited searches
    if tier_config["searches_per_month"] is None:
        return {"can_search": True, "searches_remaining": None, "tier": tier}
    
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
    
    return {
        "can_search": can_search,
        "searches_used": search_count,
        "searches_remaining": searches_remaining,
        "max_searches": max_searches,
        "tier": tier
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

# Affiliate platform URL patterns
AFFILIATE_PLATFORMS = {
    "appsumo": {
        "name": "AppSumo",
        "patterns": ["appsumo.com", "appsumo.8odi.net"]
    },
    "amazon": {
        "name": "Amazon Associates", 
        "patterns": ["amzn.to", "amazon.com/.*[?&]tag=", "amazon.co.uk/.*[?&]tag="]
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
        "patterns": ["shareasale.com"]
    },
    "cj": {
        "name": "CJ Affiliate",
        "patterns": ["cj.com", "dpbolvw.net", "jdoqocy.com", "tkqlhce.com"]
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

def get_youtube_service():
    """Get YouTube service using the backend API key"""
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="YouTube API key not configured on server")
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
    user = {
        "id": user_id,
        "email": data.email.lower(),
        "password_hash": pwd_context.hash(data.password),
        "role": "user",
        "tier": "free",  # NEW: Default tier
        "monthly_search_count": 0,
        "search_count_reset_date": datetime.now(timezone.utc).strftime("%Y-%m"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email.lower())
    return {
        "token": token, 
        "user": {
            "id": user_id, 
            "email": data.email.lower(), 
            "role": "user", 
            "tier": "free",
            "has_paid": False  # Keep for backwards compatibility
        }
    }

@api_router.post("/auth/login")
async def login(data: AuthLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not pwd_context.verify(data.password, user["password_hash"]):
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
    new_hash = pwd_context.hash(data.new_password)
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
    
    return {
        "tier": tier,
        "tier_name": tier_config["name"],
        "searches_used": search_limit_info.get("searches_used", 0),
        "searches_remaining": search_limit_info.get("searches_remaining"),
        "max_searches": search_limit_info.get("max_searches"),
        "max_results_per_search": tier_config["max_results_per_search"],
        "csv_export": tier_config["csv_export"],
        "saved_searches": tier_config["saved_searches"],
        "saved_reports": tier_config["saved_reports"],
        "pipeline_access": tier_config.get("pipeline_access", False),
        "max_pipeline_projects": tier_config.get("max_pipeline_projects"),
        "is_unlimited": tier_config["searches_per_month"] is None
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
        tier_config = get_tier_config(search_limit["tier"])
        raise HTTPException(
            status_code=403, 
            detail=f"Monthly search limit reached ({tier_config['searches_per_month']} searches). Upgrade your plan for more searches."
        )
    
    # Get YouTube service with backend API key
    try:
        youtube = get_youtube_service()
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
                    response = youtube.search().list(
                        part="snippet",
                        q=keyword,
                        type="channel",
                        maxResults=min(filters.max_results_per_keyword, 50)
                    ).execute()
                    
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
                    response = youtube.search().list(
                        part="snippet",
                        q=keyword,
                        type="video",
                        maxResults=min(filters.max_results_per_keyword, 50),
                        publishedAfter=(datetime.now(timezone.utc) - timedelta(days=filters.uploaded_within_days)).isoformat()
                    ).execute()
                    
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
        
        # Remove user-excluded channels
        excluded = await db.excluded_channels.find(
            {"user_id": user["id"]}, {"_id": 0, "channel_id": 1}
        ).to_list(length=10000)
        excluded_ids = {e["channel_id"] for e in excluded}
        if excluded_ids:
            channel_ids = [cid for cid in channel_ids if cid not in excluded_ids]
        
        # Filter by exclude keywords (match against channel title from search snippets)
        if filters.exclude_keywords:
            exclude_lower = [ek.strip().lower() for ek in filters.exclude_keywords if ek.strip()]
            if exclude_lower:
                filtered_ids = []
                for ch_id in channel_ids:
                    ch_title = channels_map[ch_id].get("title", "").lower()
                    if not any(ek in ch_title for ek in exclude_lower):
                        filtered_ids.append(ch_id)
                channel_ids = filtered_ids
        
        if tier_config["max_results_per_search"] is not None:
            channel_ids = channel_ids[:tier_config["max_results_per_search"]]
        
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
            "niche": filters.niche
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
        youtube = get_youtube_service()
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
    
    if not channel_ids:
        enriched_channels.sort(key=lambda x: x.get("score_total", 0), reverse=True)
        return {"channels": enriched_channels, "total": len(enriched_channels), "cached": len(cached_channels)}
    
    videos_to_fetch = min(videos_to_scan, 20)  # Cap at 20
    
    try:
        # Batch fetch channel details (50 at a time)
        for i in range(0, len(channel_ids), 50):
            batch = channel_ids[i:i+50]
            
            try:
                response = youtube.channels().list(
                    part="snippet,statistics,brandingSettings,contentDetails",
                    id=",".join(batch)
                ).execute()
                
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
                            playlist_response = youtube.playlistItems().list(
                                part="snippet,contentDetails",
                                playlistId=uploads_playlist,
                                maxResults=videos_to_fetch
                            ).execute()
                            
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
                            
                            # Fetch video statistics (and optionally descriptions)
                            if video_ids:
                                parts = ["statistics"]
                                if scan_video_descriptions:
                                    parts.append("snippet")
                                
                                vid_response = youtube.videos().list(
                                    part=",".join(parts),
                                    id=",".join(video_ids)
                                ).execute()
                                
                                # Track API call
                                await track_api_call("videos", 1, user["id"])
                                
                                vid_data = {v["id"]: v for v in vid_response.get("items", [])}
                                for vid in recent_videos:
                                    vid_info = vid_data.get(vid["video_id"], {})
                                    vid["view_count"] = int(vid_info.get("statistics", {}).get("viewCount", 0))
                                    # Store video description if scanning enabled
                                    if scan_video_descriptions and "snippet" in vid_info:
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
                    
                    # Affiliate platform link detection
                    # Combine channel description + video descriptions for scanning
                    full_text_to_scan = description + " " + video_descriptions_text
                    affiliate_platform_links = {}
                    affiliate_platforms_found = []
                    affiliate_platforms_count = 0
                    
                    if affiliate_platforms:
                        affiliate_platform_links, affiliate_platforms_found, affiliate_platforms_count = detect_affiliate_platform_links(
                            full_text_to_scan, affiliate_platforms
                        )
                    
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
                        # Tool Stack Detection
                        tools_section_detected=tools_section_detected,
                        tools_stack_signal_score=tools_stack_signal_score,
                        tools_section_phrases=tools_section_phrases,
                        # Channel Health Indicators
                        upload_consistency=upload_consistency,
                        upload_avg_days=upload_avg_days,
                        engagement_health=engagement_health,
                        engagement_rate=engagement_rate,
                        growth_indicator=growth_indicator
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
        
        return {"channels": enriched_channels, "total": len(enriched_channels), "cached": len(cached_channels)}
    
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
    # FTC / disclosure
    (r"(?i)#(?:ad|sponsored|paidpartnership|partner)", "disclosure"),
    (r"(?i)includes?\s+paid\s+(?:promotion|partnership)", "disclosure"),
]

AFFILIATE_LINK_PATTERNS = [
    r"amzn\.to/",
    r"amazon\.[\w.]+/.*(?:tag=|ref=)",
    r"bit\.ly/",
    r"tinyurl\.com/",
    r"go\.magik\.ly/",
    r"shrsl\.com/",
    r"rstyle\.me/",
    r"linktr\.ee/",
    r"stan\.store/",
    r"geni\.us/",
    r"howl\.me/",
    r"shopmy\.us/",
    r"lvndr\.com/",
    r"mavely\.co/",
    r"rstyle\.me/",
    r"collabs\.shop/",
    r"glnk\.io/",
    r"jdoqocy\.com/",
    r"tkqlhce\.com/",
    r"anrdoezrs\.net/",
    r"shareasale\.com/",
    r"(?:commission|affiliate|partner|ref)[_\-]?(?:link|url|id)",
]


def detect_sponsorships(videos):
    """Analyze video titles & descriptions for sponsorship signals.
    
    Args:
        videos: list of dicts with keys: video_id, title, description
    
    Returns:
        dict with sponsorship_data
    """
    detected_brands = set()
    affiliate_link_count = 0
    disclosure_count = 0
    promo_code_count = 0
    videos_with_sponsorships = []

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
        youtube = get_youtube_service()
        
        # Get uploads playlist ID
        ch_response = youtube.channels().list(
            part="contentDetails",
            id=channel_id
        ).execute()
        
        if not ch_response.get("items"):
            return {"is_sponsored_active": False, "detected_brands": [], "affiliate_link_count": 0,
                    "confidence_score": 0, "videos_analyzed": 0, "videos_with_sponsorships": []}
        
        uploads_playlist = ch_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        
        # Get last 10 video IDs
        playlist_response = youtube.playlistItems().list(
            part="contentDetails",
            playlistId=uploads_playlist,
            maxResults=10
        ).execute()
        
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
        videos_response = youtube.videos().list(
            part="snippet",
            id=",".join(video_ids)
        ).execute()
        
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

async def _cache_sponsorship_data(channel_id: str):
    """Background task to pre-cache sponsorship data for a channel."""
    try:
        youtube = get_youtube_service()
        ch_response = youtube.channels().list(part="contentDetails", id=channel_id).execute()
        if not ch_response.get("items"):
            return
        uploads_playlist = ch_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
        playlist_response = youtube.playlistItems().list(
            part="contentDetails", playlistId=uploads_playlist, maxResults=10
        ).execute()
        video_ids = [item["contentDetails"]["videoId"] for item in playlist_response.get("items", [])]
        if not video_ids:
            empty_result = {"is_sponsored_active": False, "detected_brands": [], "affiliate_link_count": 0,
                           "confidence_score": 0, "videos_analyzed": 0, "videos_with_sponsorships": []}
            await db.channels.update_many(
                {"channel_id": channel_id},
                {"$set": {"sponsorship_data": empty_result, "last_sponsorship_check": datetime.now(timezone.utc)}}
            )
            return
        videos_response = youtube.videos().list(part="snippet", id=",".join(video_ids)).execute()
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
        background_tasks.add_task(_cache_sponsorship_data, channel_id)
    
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
        # Tool Stack Detection
        "tools_section_detected", "tools_stack_signal_score",
        # Channel Health Indicators
        "upload_consistency", "upload_avg_days", "engagement_health", "engagement_rate", "growth_indicator"
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
            "growth_indicator": ch.get("growth_indicator", "")
        }
        writer.writerow(row)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=affilitube_prospects_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

class CheckoutRequest(BaseModel):
    plan: str = "pro_monthly"  # pro_monthly or pro_yearly

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
                "plan": data.plan
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def seed_admin():
    admin = await db.users.find_one({"role": "admin"})
    if not admin:
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "admin@affilitube.com",
            "password_hash": pwd_context.hash("admin123!"),
            "role": "admin",
            "tier": "pro",  # Admin gets pro tier
            "monthly_search_count": 0,
            "search_count_reset_date": datetime.now(timezone.utc).strftime("%Y-%m"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_user)
        logger.info("Admin user seeded: admin@affilitube.com")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
