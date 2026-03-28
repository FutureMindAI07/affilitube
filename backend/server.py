from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, Request
from fastapi.responses import StreamingResponse
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
db = client[os.environ['DB_NAME']]

# Auth config
JWT_SECRET = os.environ.get("JWT_SECRET", str(uuid.uuid4()))
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Encryption for API keys at rest
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

class ApiKeyInput(BaseModel):
    api_key: str

class SearchFilters(BaseModel):
    keywords: List[str]
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

def get_youtube_service(api_key: str):
    return build("youtube", "v3", developerKey=api_key, cache_discovery=False)

# ==================== SCORING ENGINE ====================

TOPIC_KEYWORDS = ['automation', 'workflow', 'zapier', 'make', 'n8n', 'no-code', 'nocode', 'ai tools', 'integrations', 'api']
TUTORIAL_KEYWORDS = ['tutorial', 'how to', 'build', 'setup', 'guide', 'learn', 'step by step', 'beginner']
AFFILIATE_SIGNAL_KEYWORDS = ['best tools', 'top tools', 'review', 'vs', 'comparison', 'automation tools', 'ai tools', 'software review']

# Extended affiliate detection keywords
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

def calculate_topic_score(channel_name: str, description: str, video_titles: List[str]) -> tuple:
    """Calculate topic relevance score (0-30) and return matched tags"""
    text = f"{channel_name} {description} {' '.join(video_titles)}".lower()
    matched = []
    for keyword in TOPIC_KEYWORDS:
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

def detect_affiliate_signals(channel_name: str, description: str, video_titles: List[str]) -> List[str]:
    """Detect affiliate likelihood signals"""
    text = f"{channel_name} {description} {' '.join(video_titles)}".lower()
    signals = []
    for keyword in AFFILIATE_SIGNAL_KEYWORDS:
        if keyword in text:
            signals.append(keyword)
    return signals

def detect_affiliate_language(description: str, video_titles: List[str], notes: str = "") -> tuple:
    """
    Detect affiliate/review intent keywords.
    Returns: (matched_keywords, count, has_affiliate_language, does_reviews, has_link_in_bio)
    """
    text = f"{description} {' '.join(video_titles)} {notes}".lower()
    matched = []
    
    for keyword in AFFILIATE_LANGUAGE_KEYWORDS:
        if keyword in text:
            matched.append(keyword)
    
    # Check boolean flags
    has_affiliate = any(kw in text for kw in ['affiliate', 'referral', 'partner', 'sponsor', 'discount code', 'coupon', 'appsumo'])
    does_reviews = any(kw in text for kw in REVIEW_KEYWORDS)
    has_link_in_bio = any(kw in text for kw in LINK_IN_BIO_KEYWORDS)
    
    return matched, len(matched), has_affiliate, does_reviews, has_link_in_bio

def detect_commercial_signals(description: str, notes: str = "") -> tuple:
    """
    Detect commercial/product signals.
    Returns: (matched_keywords, count, product_monetization)
    """
    text = f"{description} {notes}".lower()
    matched = []
    
    for keyword in COMMERCIAL_KEYWORDS:
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email.lower())
    return {"token": token, "user": {"id": user_id, "email": data.email.lower(), "role": "user", "has_paid": False}}

@api_router.post("/auth/login")
async def login(data: AuthLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not pwd_context.verify(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "role": user.get("role", "user"), "has_paid": user.get("has_paid", False)}}

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    user["has_paid"] = user.get("has_paid", False)
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
        msg["Subject"] = "Tubiate — Password Reset Code"

        body = f"""Hi,

You requested a password reset for your Tubiate account.

Your reset code is: {reset_code}

This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.

— Tubiate"""
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
    return {"message": "Tubiate API"}

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
    msg["Subject"] = f"[Tubiate Bug] [{severity.upper()}] {subject}"

    body = f"""Bug Report from Tubiate Dashboard

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

# Settings endpoints
@api_router.post("/settings/api-key")
async def save_api_key(input: ApiKeyInput, skip_validation: bool = False, user=Depends(get_current_user)):
    """Save YouTube API key"""
    validated = False
    
    if not skip_validation and input.api_key.startswith("AIza"):
        try:
            youtube = get_youtube_service(input.api_key)
            youtube.channels().list(part="snippet", id="UC_x5XG1OV2P6uZZ5FSM9Ttw").execute()
            validated = True
        except HttpError as e:
            if "keyInvalid" in str(e) or "API key not valid" in str(e):
                raise HTTPException(status_code=400, detail="Invalid API key. Please check your key and try again.")
            validated = True
        except Exception as e:
            logger.warning(f"API key validation error: {e}")
    
    await db.settings.update_one(
        {"key": "youtube_api_key", "user_id": user["id"]},
        {"$set": {
            "value": encrypt_value(input.api_key),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "validated": validated,
            "user_id": user["id"]
        }},
        upsert=True
    )
    return {"success": True, "message": "API key saved successfully", "validated": validated}

@api_router.get("/settings/api-key")
async def get_api_key_status(user=Depends(get_current_user)):
    """Check if API key exists"""
    setting = await db.settings.find_one({"key": "youtube_api_key", "user_id": user["id"]}, {"_id": 0})
    if setting and setting.get("value"):
        return {"exists": True, "updated_at": setting.get("updated_at")}
    return {"exists": False}

@api_router.get("/settings/api-key/value")
async def get_api_key_value(user=Depends(get_current_user)):
    """Get the actual API key value"""
    setting = await db.settings.find_one({"key": "youtube_api_key", "user_id": user["id"]}, {"_id": 0})
    if setting and setting.get("value"):
        return {"api_key": decrypt_value(setting["value"])}
    raise HTTPException(status_code=404, detail="API key not configured")

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
    # Get user's API key
    setting = await db.settings.find_one({"key": "youtube_api_key", "user_id": user["id"]}, {"_id": 0})
    if not setting or not setting.get("value"):
        raise HTTPException(status_code=400, detail="YouTube API key not configured")
    
    api_key = decrypt_value(setting["value"])
    youtube = get_youtube_service(api_key)
    
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
                            channels_map[ch_id] = {"keywords": [], "sources": set()}
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
                            channels_map[ch_id] = {"keywords": [], "sources": set()}
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
        
        # Determine search source for each channel
        channel_metadata = {}
        for ch_id, data in channels_map.items():
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
        
        return {
            "channel_ids": list(channels_map.keys()),
            "channel_metadata": channel_metadata,
            "total_found": len(channels_map)
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
    setting = await db.settings.find_one({"key": "youtube_api_key", "user_id": user["id"]}, {"_id": 0})
    if not setting or not setting.get("value"):
        raise HTTPException(status_code=400, detail="YouTube API key not configured")
    
    api_key = decrypt_value(setting["value"])
    youtube = get_youtube_service(api_key)
    
    channel_ids = req.channel_ids
    channel_metadata = req.channel_metadata
    min_subscribers = req.min_subscribers
    max_subscribers = req.max_subscribers
    videos_to_scan = req.videos_to_scan
    scan_video_descriptions = req.scan_video_descriptions
    max_channels_to_enrich = req.max_channels_to_enrich
    affiliate_platforms = req.affiliate_platforms
    
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
    
    enriched_channels = []
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
                    
                    # Calculate scores
                    score_topic, topic_tags = calculate_topic_score(
                        snippet.get("title", ""),
                        snippet.get("description", ""),
                        video_titles
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
                    
                    # Detect affiliate signals (original)
                    affiliate_signals = detect_affiliate_signals(
                        snippet.get("title", ""),
                        snippet.get("description", ""),
                        video_titles
                    )
                    
                    # NEW: Extended affiliate language detection
                    description = snippet.get("description", "")
                    aff_keywords, aff_count, has_affiliate_language, does_reviews, has_link_in_bio = detect_affiliate_language(
                        description, video_titles, ""
                    )
                    
                    # NEW: Commercial signals detection
                    commercial_signals, commercial_count, product_monetization = detect_commercial_signals(
                        description, ""
                    )
                    
                    # NEW: Brand contact signals detection
                    brand_contact_signals, brand_contact_count = detect_brand_contact_signals(description)
                    
                    # NEW: Business email detection
                    has_business_email, business_email = detect_business_email(description)
                    
                    # NEW: Affiliate platform link detection
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
                        tools_section_phrases=tools_section_phrases
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

# Search History endpoints
@api_router.post("/search-history")
async def save_search_history(input: SaveSearchInput, user=Depends(get_current_user)):
    """Save a search to history"""
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
        "tools_section_detected", "tools_stack_signal_score"
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
            "tools_stack_signal_score": ch.get("tools_stack_signal_score", 0)
        }
        writer.writerow(row)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=youtube_prospects_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

class CheckoutRequest(BaseModel):
    pass

# ==================== STRIPE CHECKOUT ====================

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")
STRIPE_PRICE_ID = "price_1TBCOiPnblls1SrQj1rGEBJP"
LIFETIME_DEAL_CURRENCY = "usd"

@api_router.post("/checkout/create-session")
async def create_checkout_session(data: CheckoutRequest, request: Request, user=Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Check if user already paid
    existing_payment = await db.payment_transactions.find_one({
        "user_id": user["id"],
        "payment_status": "paid"
    })
    if existing_payment:
        raise HTTPException(status_code=400, detail="You already have lifetime access")

    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/pricing"

    checkout_request = CheckoutSessionRequest(
        stripe_price_id=STRIPE_PRICE_ID,
        quantity=1,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["id"],
            "user_email": user["email"],
            "product": "tubiate_lifetime",
        }
    )

    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    # Record pending transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "stripe_price_id": STRIPE_PRICE_ID,
        "currency": LIFETIME_DEAL_CURRENCY,
        "payment_status": "pending",
        "product": "tubiate_lifetime",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request, user=Depends(get_current_user)):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Verify this session belongs to the requesting user
    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Session not found")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

    # Update transaction status
    new_status = status.payment_status if status.payment_status else status.status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # If paid, mark user as having lifetime access (only once)
    if new_status == "paid":
        await db.users.update_one(
            {"id": user["id"], "has_paid": {"$ne": True}},
            {"$set": {"has_paid": True, "paid_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {
        "status": status.status,
        "payment_status": new_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        if webhook_response.payment_status == "paid" and webhook_response.session_id:
            txn = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
            if txn and txn.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": webhook_response.session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                user_id = webhook_response.metadata.get("user_id") or txn.get("user_id")
                if user_id:
                    await db.users.update_one(
                        {"id": user_id, "has_paid": {"$ne": True}},
                        {"$set": {"has_paid": True, "paid_at": datetime.now(timezone.utc).isoformat()}}
                    )
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "detail": str(e)}

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
            "email": "admin@tubiate.com",
            "password_hash": pwd_context.hash("admin123!"),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_user)
        logger.info("Admin user seeded: admin@tubiate.com")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
