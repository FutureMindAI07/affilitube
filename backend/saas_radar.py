"""
SaaS Radar - Pre-validation tool for discovering SaaS founders from ProductHunt.

Admin-only module that:
  1. Ingests recent SaaS-relevant ProductHunt launches via the official GraphQL API.
  2. Checks each product's website for liveness, paid pricing, and affiliate program signals.
  3. Buckets prospects (Yellow > Green > Red > Unknown) and surfaces them in a sortable table.
  4. Exports prospects as CSV.

This module is intentionally self-contained so it can be removed or productized
without churn in the main server.py.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import queue
import re
import threading
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql"
PH_TOKEN = os.environ.get("PRODUCTHUNT_TOKEN")

# Topics that capture SaaS broadly (option B from user).
DEFAULT_SAAS_TOPICS = [
    "saas",
    "marketing",
    "productivity",
    "developer-tools",
    "sales",
    "analytics",
    "crm",
    "design-tools",
    "email",
    "artificial-intelligence",
    "automation",
]

# Bucket scoring (per user spec).
BUCKET_SCORES = {
    "yellow": 100,  # Paid SaaS, no affiliate program detected -> top priority
    "green": 80,   # Has affiliate program detected
    "red": 10,
    "unknown": 0,
}

# Affiliate platform footprints we look for in HTML.
AFFILIATE_PLATFORM_FOOTPRINTS = {
    "rewardful": [r"rewardful\.com", r"r\.wdfl\.co", r"cdn\.rewardful\.com"],
    "firstpromoter": [r"firstpromoter\.com", r"fprom\.co"],
    "partnerstack": [r"partnerstack\.com", r"\.grsm\.io"],
    "tapfiliate": [r"tapfiliate\.com", r"trk\.tapfiliate"],
    "impact": [r"impact\.com/affiliate", r"ojrq\.net"],
    "refersion": [r"refersion\.com"],
    "leaddyno": [r"leaddyno\.com"],
    "post-affiliate-pro": [r"postaffiliatepro\.com"],
    "trackdesk": [r"trackdesk\.com"],
    "affiliatly": [r"affiliatly\.com"],
    "goaffpro": [r"goaffpro\.com"],
}

# URL paths likely to host affiliate program info.
AFFILIATE_PATHS = [
    "/affiliates",
    "/affiliate",
    "/affiliate-program",
    "/partners",
    "/partner",
    "/partner-program",
    "/become-a-partner",
    "/referral",
    "/referrals",
    "/referral-program",
    "/ambassadors",
]

# Pricing page paths.
PRICING_PATHS = ["/pricing", "/plans", "/price"]

# Keyword regexes for affiliate program content matching.
AFFILIATE_KEYWORDS_RX = re.compile(
    r"(affiliate\s+program|partner\s+program|referral\s+program|"
    r"earn\s+(?:a\s+)?commission|commission\s+on\s+(?:each|every)|"
    r"recurring\s+commission|become\s+(?:an\s+)?affiliate|"
    r"become\s+(?:a\s+)?partner|join\s+our\s+affiliate)",
    re.IGNORECASE,
)

# Keyword regexes for paid pricing signal (per month / per year / $X /mo).
PRICING_KEYWORDS_RX = re.compile(
    r"(\$\s?\d+(?:\.\d+)?\s*(?:/\s*|per\s+)(?:mo|month|yr|year)|"
    r"€\s?\d+\s*(?:/\s*|per\s+)(?:mo|month)|"
    r"£\s?\d+\s*(?:/\s*|per\s+)(?:mo|month)|"
    r"\bper\s+month\b|\bper\s+year\b|\bbilled\s+(?:monthly|annually)\b|"
    r"\bpro\s+plan\b|\bstarter\s+plan\b|\bbusiness\s+plan\b|"
    r"\benterprise\s+plan\b|\bteam\s+plan\b)",
    re.IGNORECASE,
)

# Match common email pattern, allow plus addressing, exclude obvious junk later.
EMAIL_RX = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")

# Domains that are clearly placeholders (IANA-reserved or convention).
EMAIL_BLACKLIST_DOMAINS = {
    "example.com", "example.org", "example.net", "example.io",
    "test.com", "test.org", "domain.com", "yourdomain.com",
    "company.com", "yourcompany.com", "mycompany.com", "samplecompany.com",
    "yoursite.com", "mysite.com", "site.com", "samplesite.com",
    "yourbusiness.com", "mybusiness.com", "business.com",
    "youremail.com", "myemail.com", "email.com", "mail.com",
    "yourdomain.io", "yourwebsite.com", "mywebsite.com", "website.com",
    "localhost", "localhost.com",
    "wixsite.com", "wixpress.com",
}

# Local-parts that are obviously placeholder names.
EMAIL_BLACKLIST_LOCAL_EXACT = {
    "your", "you", "yourname", "your.name", "your_name",
    "name", "yourfullname", "fullname",
    "jane", "janedoe", "jane.doe", "jane_doe",
    "john", "johndoe", "john.doe", "john_doe",
    "mary", "marydoe", "mary.doe",
    "doe", "joe", "alice", "bob",
    "foo", "bar", "baz", "qux",
    "example", "sample", "test", "tester", "demo", "demouser",
    "user", "username",
    "firstname.lastname", "first.last", "firstname",
    "noreply", "no-reply", "donotreply", "do-not-reply",
}

# Generic substrings that indicate noise/non-contact emails.
EMAIL_BLACKLIST_SUBSTRINGS = (
    "sentry", "wixpress",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    "mailer-daemon", "postmaster",
)

# Concurrency limits.
# Lowered from 6 → 3 (Tier A perf fix): keeps event loop slack for user-facing
# requests while SaaS Radar enrichment is running. Combined with _Pacer below.
WEBSITE_CHECK_CONCURRENCY = 3
WEBSITE_FETCH_TIMEOUT = 12.0
# Minimum gap between outbound site fetches (token-bucket style). Applied
# globally per enrichment run so 200+ products don't burst-hammer external
# sites and we don't saturate the loop with too many concurrent fetches.
OUTBOUND_FETCH_MIN_INTERVAL_SECS = 0.2
USER_AGENT = "Mozilla/5.0 (compatible; AffiliTube-SaaSRadar/1.0; +https://affilitube.com)"


class _Pacer:
    """Async token-bucket-ish pacer.

    Ensures at least `min_interval` seconds between releases across all
    coroutines sharing the same instance. Used to throttle outbound HTTP
    fetches in SaaS Radar enrichment so we don't burst the event loop or
    external hosts. Lightweight: a single asyncio.Lock + a monotonic
    "next allowed" timestamp.
    """

    def __init__(self, min_interval_secs: float):
        self.min_interval = max(0.0, float(min_interval_secs))
        self._next_at = 0.0
        self._lock = asyncio.Lock()

    async def wait(self):
        if self.min_interval <= 0:
            return
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            if now < self._next_at:
                delay = self._next_at - now
                await asyncio.sleep(delay)
                now = loop.time()
            self._next_at = now + self.min_interval


# ============================================================================
# Dedicated background-worker thread (Tier C+ event-loop isolation)
# ----------------------------------------------------------------------------
# FastAPI BackgroundTasks runs coroutines on the *same* asyncio event loop as
# the API request handlers. A long enrich/ingest job (5-15 minutes of httpx
# fetches + regex parsing) keeps that loop saturated and starves user-facing
# requests — login spinners, SaaS Radar /products polls, Brand Intelligence
# fetches all queue up behind the bg task.
#
# This module isolates the work entirely: a SINGLE long-lived daemon thread
# owns a SINGLE asyncio event loop and a SINGLE AsyncIOMotorClient. Jobs are
# pushed onto a thread-safe queue and dispatched sequentially.
#
# Why long-lived (not spawn-per-job)?
#   Spawning a fresh AsyncIOMotorClient per job leaks MongoDB connections into
#   Atlas's pool (default maxPoolSize=100 per client). After a few enrich
#   runs the cluster's connection cap is exhausted and EVERY Mongo-backed
#   endpoint — SaaS Radar list, channel sponsorship-data, etc. — starts
#   timing out. A single long-lived client with a small pool eliminates that.
#
# Trade-offs:
#   • One global worker → jobs are serialized (matches the 503 "one at a time"
#     guard we already enforce on the API side).
#   • Worker survives the lifetime of the process; if it crashes once we
#     auto-restart it on the next submit().
# ============================================================================

# Capped Motor pool used by the worker. Far below the default 100 so we cannot
# starve MongoDB Atlas's free-tier connection cap (~500) even across many runs.
_WORKER_MOTOR_POOL_SIZE = 10


class _RadarWorker:
    """Long-lived worker thread with its own asyncio loop + Motor client.

    Submit coroutine-factories via `submit(coro_factory)` where `coro_factory`
    is `Callable[[motor_db], Coroutine]`. The factory is invoked on the
    worker's event loop and awaited to completion. Exceptions are logged
    (and surface to the caller via the SaaS Radar `saas_radar_jobs` collection
    which `_bg_enrich` / `_bg_ingest` write to in their finally blocks).
    """

    def __init__(self) -> None:
        self._queue: "queue.Queue[Optional[Callable]]" = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._client: Optional[AsyncIOMotorClient] = None
        self._db = None
        self._ready = threading.Event()
        self._lock = threading.Lock()

    def _is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def _start(self) -> None:
        with self._lock:
            if self._is_alive():
                return
            self._ready.clear()
            self._thread = threading.Thread(
                target=self._run, daemon=True, name="saas-radar-worker"
            )
            self._thread.start()
            # Wait up to 5s for the thread to set up its loop + Motor client.
            if not self._ready.wait(timeout=5.0):
                logger.warning("SaaS Radar worker did not become ready within 5s")

    def _run(self) -> None:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self._loop = loop
            mongo_url = os.environ.get("MONGO_URL")
            db_name = os.environ.get("DB_NAME")
            client = AsyncIOMotorClient(mongo_url, maxPoolSize=_WORKER_MOTOR_POOL_SIZE)
            self._client = client
            self._db = client[db_name]
            self._ready.set()
            logger.info(
                "SaaS Radar worker thread READY (maxPoolSize=%s)",
                _WORKER_MOTOR_POOL_SIZE,
            )
            try:
                loop.run_until_complete(self._dispatch())
            finally:
                try:
                    client.close()
                except Exception:
                    logger.exception("Motor client close failed in worker")
                try:
                    loop.close()
                except Exception:
                    pass
        except Exception:
            logger.exception("SaaS Radar worker thread died")
            # Clear state so the next submit() can spin a fresh worker up.
            self._thread = None
            self._loop = None
            self._client = None
            self._db = None
            self._ready.clear()

    async def _dispatch(self) -> None:
        loop = asyncio.get_running_loop()
        while True:
            # Blocking queue.get must run off the event loop or the loop stalls.
            coro_factory = await loop.run_in_executor(None, self._queue.get)
            if coro_factory is None:
                logger.info("SaaS Radar worker received stop sentinel; exiting")
                break
            try:
                await coro_factory(self._db)
            except Exception:
                logger.exception("SaaS Radar worker job raised; continuing")

    def submit(self, coro_factory: Callable) -> None:
        """Queue a coroutine factory for execution on the worker thread.

        coro_factory: takes the worker's Motor db handle and returns a coroutine.
        Lazily starts (or restarts) the worker thread if needed.
        """
        if not self._is_alive():
            self._start()
        if not self._ready.wait(timeout=5.0):
            raise RuntimeError("SaaS Radar worker failed to initialize")
        self._queue.put(coro_factory)


# Module-level singleton. Lazy-started on first submit().
_radar_worker = _RadarWorker()


def start_radar_worker(coro_factory: Callable) -> None:
    """Public API: queue a job onto the long-lived worker thread.

    Kept as a free function so callers (API endpoints + the daily cron) don't
    need to know about the singleton.
    """
    _radar_worker.submit(coro_factory)


# ============================================================================
# ProductHunt GraphQL Client
# ============================================================================

PH_POSTS_QUERY = """
query Posts(
  $postedAfter: DateTime
  $postedBefore: DateTime
  $after: String
) {
  posts(
    postedAfter: $postedAfter
    postedBefore: $postedBefore
    after: $after
    first: 20
    order: NEWEST
  ) {
    edges {
      cursor
      node {
        id
        name
        tagline
        slug
        url
        website
        createdAt
        votesCount
        topics {
          edges {
            node {
              id
              name
              slug
            }
          }
        }
        makers {
          id
          name
          username
          twitterUsername
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""


class PHClientError(Exception):
    pass


class PHRateLimitError(PHClientError):
    def __init__(self, reset_in: int):
        self.reset_in = reset_in
        super().__init__(f"Rate limit hit, reset in {reset_in}s")


async def ph_fetch_posts(
    posted_after: datetime,
    posted_before: datetime,
    after_cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """Single page fetch from the PH GraphQL API (no topic filter; we filter locally)."""
    if not PH_TOKEN:
        raise PHClientError("PRODUCTHUNT_TOKEN not configured")

    variables = {
        "postedAfter": posted_after.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        "postedBefore": posted_before.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z"),
        "after": after_cursor,
    }
    headers = {
        "Authorization": f"Bearer {PH_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            PH_GRAPHQL_URL,
            headers=headers,
            json={"query": PH_POSTS_QUERY, "variables": variables},
        )
    if resp.status_code == 401:
        raise PHClientError("ProductHunt token is invalid (401)")
    if resp.status_code == 429:
        # PH sometimes returns rate-limit as HTTP 429 with details in body
        reset_in = 900
        try:
            body = resp.json()
            for e in body.get("errors", []):
                details = e.get("details") or {}
                if details.get("reset_in"):
                    reset_in = int(details["reset_in"])
                    break
        except Exception:
            pass
        raise PHRateLimitError(reset_in)
    if resp.status_code != 200:
        raise PHClientError(f"ProductHunt HTTP {resp.status_code}: {resp.text[:200]}")

    payload = resp.json()
    if "errors" in payload:
        errs = payload["errors"]
        # detect rate limit
        for e in errs:
            if isinstance(e, dict) and e.get("error") == "rate_limit_reached":
                reset_in = (e.get("details") or {}).get("reset_in") or 900
                raise PHRateLimitError(int(reset_in))
        raise PHClientError(f"ProductHunt GraphQL error: {errs}")
    return payload["data"]["posts"]


async def ph_ingest_window(
    db,
    posted_after: datetime,
    posted_before: datetime,
    topics_filter: List[str],
    job_id: str,
    resume_cursor: Optional[str] = None,
) -> Dict[str, Any]:
    """Single-stream ingest for a date window. Filters topics LOCALLY post-fetch,
    so we don't burn 10x complexity points doing one query per topic.

    Returns {seen, new, rate_limited, rate_limit_reset, last_cursor, pages}.
    `last_cursor` lets the caller resume the same window after a rate-limit pause.
    """
    seen = 0
    new = 0
    rate_limited = False
    rate_limit_reset = 0
    topic_set = {t.lower() for t in topics_filter} if topics_filter else None
    after_cursor = resume_cursor
    page = 0
    while True:
        page += 1
        try:
            conn = await ph_fetch_posts(posted_after, posted_before, after_cursor)
        except PHRateLimitError as e:
            # Don't sleep — bubble up partial results so the user sees progress and can re-run later.
            logger.warning(
                "Rate limited mid-ingest after seen=%s new=%s page=%s; finishing partial",
                seen, new, page,
            )
            rate_limited = True
            rate_limit_reset = e.reset_in
            break
        except PHClientError as e:
            logger.warning("PH fetch failed page=%s: %s", page, e)
            if "401" in str(e):
                raise
            # Don't silently swallow — propagate so the job marks itself errored.
            raise

        edges = conn.get("edges", []) or []
        if not edges:
            break

        for edge in edges:
            node = edge.get("node") or {}
            ph_id = node.get("id")
            if not ph_id:
                continue
            topics_flat = [
                e["node"]["slug"]
                for e in (node.get("topics") or {}).get("edges", [])
                if e.get("node")
            ]
            # Local topic filter (case-insensitive)
            if topic_set and not any(t.lower() in topic_set for t in topics_flat):
                continue
            seen += 1
            makers = node.get("makers") or []
            makers_flat = [
                {
                    "name": m.get("name"),
                    "username": m.get("username"),
                    "twitter_username": m.get("twitterUsername"),
                }
                for m in makers
            ]
            update_doc = {
                "ph_id": ph_id,
                "name": node.get("name"),
                "tagline": node.get("tagline"),
                "slug": node.get("slug"),
                "ph_url": node.get("url"),
                "website_url": node.get("website"),
                "votes_count": node.get("votesCount") or 0,
                "topics": topics_flat,
                "makers": makers_flat,
                "posted_at": _parse_iso(node.get("createdAt")),
                "updated_at": datetime.now(timezone.utc),
                "ingested_job_id": job_id,
            }
            result = await db.saas_radar_products.update_one(
                {"ph_id": ph_id},
                {
                    "$set": update_doc,
                    "$setOnInsert": {
                        "id": str(uuid.uuid4()),
                        "created_at": datetime.now(timezone.utc),
                        "site_status": None,
                        "site_checked_at": None,
                        "has_pricing": False,
                        "has_affiliate_program": False,
                        "affiliate_platform_detected": None,
                        "affiliate_program_url": None,
                        "pricing_url": None,
                        "multiple_paid_tiers": False,
                        "emails_found": [],
                        "bucket": "unknown",
                        "score": 0,
                        "notes": [],
                    },
                },
                upsert=True,
            )
            if result.upserted_id is not None:
                new += 1

            # Yield control to the event loop between edges so user-facing
            # requests don't starve while we burn through a large chunk
            # (Tier A perf fix). Zero-cost when nothing else is ready.
            await asyncio.sleep(0)

        page_info = conn.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        after_cursor = page_info.get("endCursor")

        # Periodic progress write so the user sees live counts
        if page % 2 == 0:
            await db.saas_radar_jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "progress": {"seen": seen, "new": new, "page": page},
                    "updated_at": datetime.now(timezone.utc),
                }},
            )

        # Small breather between pages.
        await asyncio.sleep(0.4)

    return {
        "seen": seen,
        "new": new,
        "rate_limited": rate_limited,
        "rate_limit_reset": rate_limit_reset,
        "last_cursor": after_cursor,
        "pages": page,
    }


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


# ============================================================================
# Website Enrichment (alive check + affiliate / pricing detection)
# ============================================================================


async def _fetch_html(
    client: httpx.AsyncClient,
    url: str,
    pacer: Optional["_Pacer"] = None,
) -> Tuple[Optional[int], str, Optional[str]]:
    """GET a URL, return (status, text, final_url). text='' on failure.

    If `pacer` is provided, awaits it before issuing the request so that the
    global rate-limit is respected across concurrent enrichment workers.
    """
    if pacer is not None:
        await pacer.wait()
    try:
        r = await client.get(url, follow_redirects=True, timeout=WEBSITE_FETCH_TIMEOUT)
        ct = r.headers.get("content-type", "")
        if "html" not in ct.lower() and "text" not in ct.lower():
            return r.status_code, "", str(r.url)
        return r.status_code, r.text or "", str(r.url)
    except Exception as e:
        logger.debug("fetch failed %s: %s", url, e)
        return None, "", None


def _extract_emails(html: str, domain: str) -> List[str]:
    if not html:
        return []
    found = set()
    for m in EMAIL_RX.findall(html):
        m_low = m.lower()
        if any(b in m_low for b in EMAIL_BLACKLIST_SUBSTRINGS):
            continue
        if m_low.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
            continue
        # Split into local + domain parts for stricter checks.
        try:
            local, dom = m_low.split("@", 1)
        except ValueError:
            continue
        if dom in EMAIL_BLACKLIST_DOMAINS:
            continue
        if local in EMAIL_BLACKLIST_LOCAL_EXACT:
            continue
        # Placeholder patterns like "your.name", "jane.doe", "first.last"
        normalized_local = local.replace("_", ".").replace("-", ".")
        if normalized_local in EMAIL_BLACKLIST_LOCAL_EXACT:
            continue
        found.add(m_low)
    # Prefer emails matching the product's domain.
    domain_l = domain.lower()
    ranked = sorted(found, key=lambda e: (0 if domain_l in e.split("@", 1)[1] else 1, e))
    return ranked[:10]


def _detect_affiliate_platform(html: str) -> Optional[str]:
    if not html:
        return None
    for platform, patterns in AFFILIATE_PLATFORM_FOOTPRINTS.items():
        for p in patterns:
            if re.search(p, html, re.IGNORECASE):
                return platform
    return None


def _find_affiliate_link_in_html(html: str, base_url: str) -> Optional[str]:
    """Scan all <a href> + visible text for affiliate-program links."""
    if not html:
        return None
    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")
    candidates: List[Tuple[int, str]] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        text = (a.get_text() or "").strip().lower()
        href_l = href.lower()
        score = 0
        # path-based signal
        for path in AFFILIATE_PATHS:
            if path in href_l:
                score += 3
        # text-based signal
        if re.search(r"(affiliate|partner program|referral|ambassador)", text):
            score += 2
        if score > 0:
            absolute = urljoin(base_url, href)
            candidates.append((score, absolute))
    if not candidates:
        return None
    candidates.sort(key=lambda t: -t[0])
    return candidates[0][1]


def _count_paid_tiers(html: str) -> int:
    """Rough heuristic: count distinct $X /mo style price tokens."""
    if not html:
        return 0
    matches = re.findall(
        r"(?:\$|€|£)\s?\d+(?:\.\d+)?\s*(?:/|per\s+)(?:mo|month|yr|year)",
        html,
        flags=re.IGNORECASE,
    )
    # Dedupe by raw token (strip whitespace).
    return len({m.replace(" ", "").lower() for m in matches})


def _parse_enrichment_signals(
    combined_html: str,
    base_url: str,
) -> Dict[str, Any]:
    """CPU-bound HTML signal extraction.

    Pulled into a synchronous function so it can be dispatched to a thread via
    `run_in_executor`, freeing the asyncio event loop to service user requests
    while large HTML blobs are being regex'd / parsed.
    """
    aff_platform = _detect_affiliate_platform(combined_html)
    aff_link = _find_affiliate_link_in_html(combined_html, base_url)
    aff_kw_hit = bool(AFFILIATE_KEYWORDS_RX.search(combined_html))
    pricing_kw_hit = bool(PRICING_KEYWORDS_RX.search(combined_html))
    tier_count = _count_paid_tiers(combined_html)
    return {
        "aff_platform": aff_platform,
        "aff_link": aff_link,
        "aff_kw_hit": aff_kw_hit,
        "pricing_kw_hit": pricing_kw_hit,
        "tier_count": tier_count,
    }


async def enrich_one_product(
    client: httpx.AsyncClient,
    product: Dict[str, Any],
    pacer: Optional["_Pacer"] = None,
) -> Dict[str, Any]:
    """Visit the product website, gather signals, compute bucket + score.

    Returns the update document (without _id / ph_id), suitable for $set.

    `pacer`, if provided, throttles outbound site fetches across all coroutines
    sharing the same instance (Tier A perf fix).
    """
    website = (product.get("website_url") or "").strip()
    update: Dict[str, Any] = {
        "site_checked_at": datetime.now(timezone.utc),
        "site_status": None,
        "has_pricing": False,
        "has_affiliate_program": False,
        "affiliate_platform_detected": None,
        "affiliate_program_url": None,
        "pricing_url": None,
        "multiple_paid_tiers": False,
        "emails_found": [],
        "bucket": "unknown",
        "score": 0,
        "notes": [],
    }
    if not website:
        update["notes"] = ["no_website"]
        return update

    parsed = urlparse(website)
    if not parsed.scheme:
        website = "https://" + website
        parsed = urlparse(website)

    # 1) Homepage (follow_redirects=True will resolve PH /r/ redirect to real domain)
    status, home_html, final_url = await _fetch_html(client, website, pacer=pacer)
    update["site_status"] = status
    if status is None:
        update["bucket"] = "unknown"
        update["score"] = BUCKET_SCORES["unknown"]
        update["notes"] = ["site_unreachable"]
        return update

    # Resolve real domain from the final URL after redirect.
    resolved_url = final_url or website
    final_parsed = urlparse(resolved_url)
    domain = final_parsed.netloc or parsed.netloc
    update["resolved_url"] = resolved_url
    update["resolved_domain"] = domain

    # If we got a 4xx/5xx OR the redirect was blocked (we end up still on producthunt.com),
    # we cannot reliably inspect the real website from this environment.
    blocked_on_ph = "producthunt.com" in domain.lower()
    if blocked_on_ph or (status >= 400):
        update["bucket"] = "unknown"
        update["score"] = BUCKET_SCORES["unknown"]
        update["notes"] = ["ph_redirect_blocked"] if blocked_on_ph else [f"http_{status}"]
        return update

    pages_html = [home_html]

    # 2) Try pricing pages
    pricing_url = None
    for p in PRICING_PATHS:
        candidate = urljoin(final_url or website, p)
        s, h, fu = await _fetch_html(client, candidate, pacer=pacer)
        if s and s < 400 and h:
            pages_html.append(h)
            if PRICING_KEYWORDS_RX.search(h):
                pricing_url = fu or candidate
                break

    # 3) Try affiliate paths
    aff_url = None
    aff_platform = None
    for p in AFFILIATE_PATHS:
        candidate = urljoin(final_url or website, p)
        s, h, fu = await _fetch_html(client, candidate, pacer=pacer)
        if s and s < 400 and h:
            pages_html.append(h)
            platform = _detect_affiliate_platform(h)
            if platform or AFFILIATE_KEYWORDS_RX.search(h):
                aff_url = fu or candidate
                aff_platform = platform
                break

    combined_html = "\n".join(pages_html)

    # CPU-heavy parsing: offload to a thread so the event loop stays responsive
    # to user-facing requests during enrichment runs (Tier A perf fix).
    loop = asyncio.get_running_loop()
    signals = await loop.run_in_executor(
        None,
        _parse_enrichment_signals,
        combined_html,
        final_url or website,
    )

    # Affiliate detection from combined html
    if not aff_platform:
        aff_platform = signals["aff_platform"]
    if not aff_url:
        aff_url = signals["aff_link"]

    has_affiliate = bool(aff_platform) or bool(aff_url) or signals["aff_kw_hit"]

    # Pricing detection
    has_pricing = bool(pricing_url) or signals["pricing_kw_hit"]
    tier_count = signals["tier_count"]

    # Emails — also CPU-bound regex over potentially-large HTML, offload too.
    emails = await loop.run_in_executor(None, _extract_emails, combined_html, domain)

    # Bucketing
    if has_affiliate:
        bucket = "green"
    elif has_pricing:
        bucket = "yellow"
    else:
        bucket = "red"

    score = BUCKET_SCORES[bucket]
    # Recency bonus (computed at score time using posted_at from product)
    posted_at = product.get("posted_at")
    if isinstance(posted_at, datetime):
        age_days = (datetime.now(timezone.utc) - posted_at.replace(tzinfo=timezone.utc)).days \
            if posted_at.tzinfo is None else (datetime.now(timezone.utc) - posted_at).days
        if age_days <= 14:
            score += 5
    if tier_count >= 2:
        score += 5
    if emails:
        score += 10

    update.update({
        "has_pricing": has_pricing,
        "has_affiliate_program": has_affiliate,
        "affiliate_platform_detected": aff_platform,
        "affiliate_program_url": aff_url,
        "pricing_url": pricing_url,
        "multiple_paid_tiers": tier_count >= 2,
        "paid_tier_count": tier_count,
        "emails_found": emails,
        "bucket": bucket,
        "score": score,
    })
    return update


async def enrich_pending_products(db, limit: int = 200, use_llm: bool = False, use_playwright: bool = False) -> Dict[str, int]:
    """Enrich products that have never been checked OR that were checked >24h ago.

    Returns counts by bucket after this run.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    # First priority: never checked. Second: stale checks.
    cursor = db.saas_radar_products.find(
        {
            "$or": [
                {"site_checked_at": None},
                {"site_checked_at": {"$lt": cutoff}},
            ],
        },
        {"_id": 0},
    ).sort([("site_checked_at", 1), ("posted_at", -1)]).limit(limit)
    products = await cursor.to_list(length=limit)

    sem = asyncio.Semaphore(WEBSITE_CHECK_CONCURRENCY)
    # Single pacer shared across all enrichment workers for this run. Min interval
    # OUTBOUND_FETCH_MIN_INTERVAL_SECS between any two outbound site fetches.
    pacer = _Pacer(OUTBOUND_FETCH_MIN_INTERVAL_SECS)
    async with httpx.AsyncClient(
        timeout=WEBSITE_FETCH_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        async def _process(p):
            async with sem:
                try:
                    update = await enrich_one_product(client, p, pacer=pacer)
                except Exception as e:
                    logger.warning("enrich error for %s: %s", p.get("website_url"), e)
                    update = {
                        "site_checked_at": datetime.now(timezone.utc),
                        "site_status": None,
                        "bucket": "unknown",
                        "score": 0,
                        "notes": ["enrich_exception"],
                    }

                # Optional headless-browser fallback for PH redirect-blocked products.
                if use_playwright and update.get("notes") and "ph_redirect_blocked" in update["notes"]:
                    resolved = await _playwright_resolve_redirect(p.get("website_url"))
                    if resolved and "producthunt.com" not in (resolved.get("final_url") or ""):
                        # We got the real domain via headless browser — re-enrich with it.
                        p_resolved = dict(p)
                        p_resolved["website_url"] = resolved["final_url"]
                        try:
                            update = await enrich_one_product(client, p_resolved, pacer=pacer)
                            update.setdefault("notes", []).append("resolved_via_playwright")
                            update["resolved_via"] = "playwright"
                        except Exception as e:
                            logger.warning("re-enrich after playwright resolve failed: %s", e)

                # Optional LLM-based reclassification (gpt-4o-mini)
                if use_llm:
                    try:
                        llm_result = await _llm_classify(p, update)
                        if llm_result:
                            update["llm_assessment"] = llm_result
                            # Apply LLM override only when LLM confidently disagrees with regex bucket
                            new_bucket = llm_result.get("bucket")
                            if new_bucket and new_bucket in BUCKET_SCORES and llm_result.get("confidence", 0) >= 0.7:
                                old_bucket = update.get("bucket", "unknown")
                                if new_bucket != old_bucket:
                                    update["bucket_regex"] = old_bucket
                                    update["bucket"] = new_bucket
                                    # Recompute score with bonuses preserved
                                    score = BUCKET_SCORES[new_bucket]
                                    if update.get("multiple_paid_tiers"):
                                        score += 5
                                    if update.get("emails_found"):
                                        score += 10
                                    update["score"] = score
                    except Exception as e:
                        logger.warning("LLM classify failed for %s: %s", p.get("name"), e)

                await db.saas_radar_products.update_one(
                    {"ph_id": p["ph_id"]},
                    {"$set": update},
                )

        await asyncio.gather(*[_process(p) for p in products])

    # Return current bucket distribution
    pipeline = [
        {"$group": {"_id": "$bucket", "count": {"$sum": 1}}},
    ]
    counts = {"green": 0, "yellow": 0, "red": 0, "unknown": 0}
    async for row in db.saas_radar_products.aggregate(pipeline):
        counts[row["_id"] or "unknown"] = row["count"]
    counts["processed"] = len(products)
    counts["use_llm"] = use_llm
    return counts


# ============================================================================
# Optional LLM classifier (gpt-4o-mini)
# ============================================================================

_OPENAI_CLIENT = None


def _get_openai_client():
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            return None
        from openai import OpenAI
        _OPENAI_CLIENT = OpenAI(api_key=key)
    return _OPENAI_CLIENT


async def _llm_classify(product: Dict[str, Any], current: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Ask gpt-4o-mini to refine the bucket assignment based on product metadata.

    Returns {bucket, confidence, reasoning, is_b2b_saas, has_paid_pricing, has_affiliate_program}
    or None if OpenAI is not configured.
    """
    client = _get_openai_client()
    if not client:
        return None

    name = product.get("name") or ""
    tagline = product.get("tagline") or ""
    topics = ", ".join(product.get("topics") or [])
    resolved_domain = current.get("resolved_domain") or "(blocked)"
    regex_signals = {
        "has_pricing": current.get("has_pricing", False),
        "multiple_paid_tiers": current.get("multiple_paid_tiers", False),
        "has_affiliate_program": current.get("has_affiliate_program", False),
        "affiliate_platform": current.get("affiliate_platform_detected"),
        "regex_bucket": current.get("bucket"),
    }
    prompt = f"""You are classifying ProductHunt launches for an outreach tool that helps SaaS founders find YouTube affiliate partners. We want to identify SaaS companies that should run an affiliate program but probably don't yet (target customers) OR already run one (warm prospects).

Product: {name}
Tagline: {tagline}
Topics: {topics}
Website domain: {resolved_domain}

Existing regex signals (may be incomplete if website was blocked):
{json.dumps(regex_signals, indent=2)}

Buckets:
- "yellow" = paid B2B SaaS WITHOUT an affiliate program (best target — they should run one)
- "green"  = SaaS WITH an existing affiliate program (warm prospect — show our better partners)
- "red"    = not a paid SaaS (free tool, pre-revenue, consumer app, hardware, etc.)
- "unknown" = insufficient info

Respond with ONLY a JSON object (no prose, no markdown) with keys:
- bucket: "yellow" | "green" | "red" | "unknown"
- confidence: 0.0-1.0
- is_b2b_saas: bool
- has_paid_pricing: bool (estimate, may differ from regex if you have higher signal from name/tagline)
- has_affiliate_program: bool
- reasoning: one-sentence justification (max 25 words)
"""

    def _call():
        return client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=200,
        )

    # The SDK is sync; run in threadpool to keep async loop free.
    resp = await asyncio.get_running_loop().run_in_executor(None, _call)
    content = resp.choices[0].message.content
    try:
        data = json.loads(content)
    except Exception:
        return None
    # Coerce + bound
    bucket = data.get("bucket")
    if bucket not in BUCKET_SCORES:
        bucket = None
    try:
        confidence = float(data.get("confidence", 0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    return {
        "bucket": bucket,
        "confidence": confidence,
        "is_b2b_saas": bool(data.get("is_b2b_saas", False)),
        "has_paid_pricing": bool(data.get("has_paid_pricing", False)),
        "has_affiliate_program": bool(data.get("has_affiliate_program", False)),
        "reasoning": (data.get("reasoning") or "")[:200],
        "model": "gpt-4o-mini",
    }


# ============================================================================
# Optional headless-browser redirect resolver (Playwright)
# ============================================================================

_PLAYWRIGHT_INSTANCE = None
_PLAYWRIGHT_BROWSER = None
_PLAYWRIGHT_LOCK = asyncio.Lock()


async def _playwright_get_browser():
    """Lazy singleton browser. Kept alive across calls to amortize startup cost."""
    global _PLAYWRIGHT_INSTANCE, _PLAYWRIGHT_BROWSER
    if _PLAYWRIGHT_BROWSER is not None:
        return _PLAYWRIGHT_BROWSER
    async with _PLAYWRIGHT_LOCK:
        if _PLAYWRIGHT_BROWSER is not None:
            return _PLAYWRIGHT_BROWSER
        try:
            from playwright.async_api import async_playwright
            _PLAYWRIGHT_INSTANCE = await async_playwright().start()
            _PLAYWRIGHT_BROWSER = await _PLAYWRIGHT_INSTANCE.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
        except Exception as e:
            logger.warning("Playwright init failed: %s", e)
            _PLAYWRIGHT_BROWSER = None
        return _PLAYWRIGHT_BROWSER


async def _playwright_resolve_redirect(url: Optional[str]) -> Optional[Dict[str, Any]]:
    """Use headless Chromium to follow a PH /r/ tracking URL to the real website.

    Returns {final_url} or None. Best-effort; Cloudflare may still block from
    cloud IPs, in which case we return None and the caller leaves the product
    marked ph_redirect_blocked.
    """
    if not url or "producthunt.com/r/" not in url.lower():
        return None
    browser = await _playwright_get_browser()
    if browser is None:
        return None
    context = None
    try:
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            logger.debug("Playwright goto failed for %s: %s", url, e)
            return None
        final = page.url
        if final and "producthunt.com" not in final:
            return {"final_url": final}
        # PH might use a JS redirect — wait a tick and check again
        try:
            await page.wait_for_timeout(2000)
            final = page.url
            if final and "producthunt.com" not in final:
                return {"final_url": final}
        except Exception:
            pass
        return None
    except Exception as e:
        logger.warning("Playwright resolve_redirect error: %s", e)
        return None
    finally:
        if context is not None:
            try:
                await context.close()
            except Exception:
                pass


async def _shutdown_playwright():
    """Clean up the singleton browser/playwright at app shutdown."""
    global _PLAYWRIGHT_BROWSER, _PLAYWRIGHT_INSTANCE
    if _PLAYWRIGHT_BROWSER is not None:
        try:
            await _PLAYWRIGHT_BROWSER.close()
        except Exception:
            pass
        _PLAYWRIGHT_BROWSER = None
    if _PLAYWRIGHT_INSTANCE is not None:
        try:
            await _PLAYWRIGHT_INSTANCE.stop()
        except Exception:
            pass
        _PLAYWRIGHT_INSTANCE = None


# ============================================================================
# Job tracking
# ============================================================================

async def _reap_stale_jobs(db, stale_after_secs: int = 180):
    """Mark any 'running' job that hasn't updated progress in stale_after_secs as orphaned.

    FastAPI BackgroundTasks live in worker memory, so a redeploy or worker restart
    kills the in-flight task while leaving the DB row stuck on 'running'. Without
    this, the UI would show 'Running…' forever and the button would stay disabled.
    Idempotent — safe to call on every read.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_after_secs)
    await db.saas_radar_jobs.update_many(
        {"status": "running", "updated_at": {"$lt": cutoff}},
        {"$set": {
            "status": "error",
            "error": "Job orphaned (worker likely restarted by a deploy or crash). Re-run to continue — existing progress is kept.",
            "updated_at": datetime.now(timezone.utc),
        }},
    )


async def _create_job(db, kind: str, payload: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    await db.saas_radar_jobs.insert_one({
        "id": job_id,
        "kind": kind,
        "payload": payload,
        "status": "running",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "result": None,
        "error": None,
    })
    return job_id


async def _finish_job(db, job_id: str, result: Dict[str, Any], error: Optional[str] = None):
    await db.saas_radar_jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "error" if error else "done",
            "result": result,
            "error": error,
            "updated_at": datetime.now(timezone.utc),
        }},
    )


CHUNK_DAYS = 15  # PH complexity budget = ~6250 pts/15min; one 15-day chunk fits comfortably.
MAX_RATE_LIMIT_WAIT_SECS = 900  # Cap any single pause at 15 minutes.


async def _bg_ingest(db, days_back: int, topics_filter: List[str], job_id: str):
    """Chunked ingest with built-in pauses when PH rate limit hits.

    Splits the requested days_back into CHUNK_DAYS-sized chunks (newest first) and
    runs them sequentially. If a chunk hits rate limit mid-stream, we sleep for the
    reset window and resume the same chunk from its last cursor — no duplicate work,
    no lost progress.
    """
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days_back)

        # Build chunks newest-first so users see fresh launches in the table first.
        chunks: List[Tuple[datetime, datetime]] = []
        cursor_end = end
        while cursor_end > start:
            cursor_start = max(cursor_end - timedelta(days=CHUNK_DAYS), start)
            chunks.append((cursor_start, cursor_end))
            cursor_end = cursor_start

        cumulative = {
            "seen": 0, "new": 0,
            "rate_limited": False, "rate_limit_reset": 0,
            "chunks_total": len(chunks), "chunks_done": 0,
            "pages": 0, "days_back": days_back,
        }

        for idx, (chunk_start, chunk_end) in enumerate(chunks):
            await db.saas_radar_jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "progress": {
                        "chunk": idx + 1,
                        "total_chunks": len(chunks),
                        "seen": cumulative["seen"],
                        "new": cumulative["new"],
                        "stage": f"chunk {idx+1}/{len(chunks)} ({chunk_start.date()} → {chunk_end.date()})",
                    },
                    "updated_at": datetime.now(timezone.utc),
                }},
            )

            resume_cursor: Optional[str] = None
            chunk_retries = 0
            while chunk_retries < 4:  # max 4 retries per chunk
                try:
                    res = await ph_ingest_window(
                        db, chunk_start, chunk_end, topics_filter, job_id,
                        resume_cursor=resume_cursor,
                    )
                except PHClientError as e:
                    if "401" in str(e):
                        await _finish_job(db, job_id, cumulative, error=f"PH auth failed: {e}")
                        return
                    raise

                cumulative["seen"] += res["seen"]
                cumulative["new"] += res["new"]
                cumulative["pages"] += res["pages"]

                if res["rate_limited"]:
                    wait = min(max(res.get("rate_limit_reset", 660) + 5, 60), MAX_RATE_LIMIT_WAIT_SECS)
                    logger.info(
                        "Chunk %s/%s rate-limited after %s posts; sleeping %ss",
                        idx + 1, len(chunks), res["seen"], wait,
                    )
                    # Tick progress every 30s during sleep so the UI shows a live countdown.
                    elapsed = 0
                    tick = 30
                    while elapsed < wait:
                        remaining = wait - elapsed
                        await db.saas_radar_jobs.update_one(
                            {"id": job_id},
                            {"$set": {
                                "progress": {
                                    "chunk": idx + 1,
                                    "total_chunks": len(chunks),
                                    "seen": cumulative["seen"],
                                    "new": cumulative["new"],
                                    "stage": (
                                        f"chunk {idx+1}/{len(chunks)} · waiting for PH rate-limit reset "
                                        f"({remaining}s remaining)"
                                    ),
                                    "paused_remaining": remaining,
                                },
                                "updated_at": datetime.now(timezone.utc),
                            }},
                        )
                        await asyncio.sleep(min(tick, remaining))
                        elapsed += tick
                    resume_cursor = res.get("last_cursor")
                    chunk_retries += 1
                else:
                    break
            else:
                # Exhausted retries on this chunk; bail out with partial.
                cumulative["rate_limited"] = True
                cumulative["chunks_done"] = idx
                await _finish_job(
                    db, job_id, cumulative,
                    error=(
                        f"PH rate limit blocked chunk {idx+1}/{len(chunks)} after "
                        f"{chunk_retries} retries. Partial ingest stored "
                        f"({cumulative['new']} new). Click Run Ingest again to continue."
                    ),
                )
                return

            cumulative["chunks_done"] = idx + 1

        await _finish_job(db, job_id, cumulative)
    except Exception as e:
        logger.exception("ingest job failed")
        await _finish_job(db, job_id, {}, error=str(e))


async def _bg_enrich(db, limit: int, use_llm: bool, use_playwright: bool, job_id: str):
    try:
        counts = await enrich_pending_products(db, limit=limit, use_llm=use_llm, use_playwright=use_playwright)
        await _finish_job(db, job_id, counts)
    except Exception as e:
        logger.exception("enrich job failed")
        await _finish_job(db, job_id, {}, error=str(e))


# ============================================================================
# Router
# ============================================================================

class IngestRequest(BaseModel):
    days_back: int = Field(default=90, ge=1, le=365)
    topics: Optional[List[str]] = None


class EnrichRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=500)
    use_llm: bool = Field(default=False)
    use_playwright: bool = Field(default=False)


class VerdictRequest(BaseModel):
    verdict: Optional[str] = Field(default=None)  # "customer" | "pass" | "later" | "sent" | None


VALID_VERDICTS = {"customer", "pass", "later", "sent", None, ""}

# Outreach pipeline for founder prospects discovered via SaaS Radar.
# Mirrors the channel outreach flow in server.py: every status change appends a
# {timestamp, status, note} entry to contact_log so the same dropdown can auto-log
# events AND accept ad-hoc note entries on top.
VALID_OUTREACH_STATUSES = {
    "not_contacted", "contacted", "replied", "in_negotiation",
    "agreed", "declined", "no_response",
}


class UpdateFounderOutreachStatusInput(BaseModel):
    status: str
    note: Optional[str] = None


class UpdateFounderFollowUpDateInput(BaseModel):
    follow_up_date: Optional[datetime] = None


class UpdateFounderNotesInput(BaseModel):
    outreach_notes: str = ""



def build_router(db, admin_dep) -> APIRouter:
    """Build the SaaS Radar router. admin_dep is the FastAPI dependency that
    returns the admin user (e.g. get_admin_user)."""
    router = APIRouter(prefix="/admin/saas-radar", tags=["saas-radar"])

    @router.get("/config")
    async def get_config(admin=Depends(admin_dep)):
        return {
            "token_configured": bool(PH_TOKEN),
            "token_length": len(PH_TOKEN) if PH_TOKEN else 0,
            "token_preview": (PH_TOKEN[:4] + "…" + PH_TOKEN[-4:]) if PH_TOKEN and len(PH_TOKEN) > 10 else None,
            "default_topics": DEFAULT_SAAS_TOPICS,
        }

    @router.get("/diagnose")
    async def diagnose(admin=Depends(admin_dep)):
        """Layered connectivity check to api.producthunt.com.
        Each step has its own tight timeout so we never blow past the ingress timeout.
        """
        import socket
        steps: List[Dict[str, Any]] = []

        def add(name: str, ok: bool, detail: Any = None, error: Optional[str] = None):
            steps.append({"step": name, "ok": ok, "detail": detail, "error": error})

        # 0) Token check
        add("token_loaded", bool(PH_TOKEN), {
            "length": len(PH_TOKEN) if PH_TOKEN else 0,
            "preview": (PH_TOKEN[:4] + "…" + PH_TOKEN[-4:]) if PH_TOKEN and len(PH_TOKEN) > 10 else None,
        })
        if not PH_TOKEN:
            return {"ok": False, "steps": steps}

        # 1) DNS lookup
        try:
            ip = await asyncio.get_running_loop().run_in_executor(
                None, socket.gethostbyname, "api.producthunt.com"
            )
            add("dns_resolve", True, {"resolved_ip": ip})
        except Exception as e:
            add("dns_resolve", False, error=str(e))
            return {"ok": False, "steps": steps}

        # 2) HTTPS HEAD to PH root (8s timeout) — pure connectivity check, no auth
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get("https://api.producthunt.com/", headers={"User-Agent": USER_AGENT})
            add("https_reachable", True, {"status": r.status_code})
        except Exception as e:
            add("https_reachable", False, error=f"{type(e).__name__}: {e}")
            return {"ok": False, "steps": steps}

        # 3) Auth check via tiny viewer query (8s timeout)
        viewer_q = "query { viewer { user { id name username } } }"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(
                    PH_GRAPHQL_URL,
                    headers={
                        "Authorization": f"Bearer {PH_TOKEN}",
                        "Content-Type": "application/json",
                        "User-Agent": USER_AGENT,
                    },
                    json={"query": viewer_q},
                )
            try:
                vp = r.json()
            except Exception:
                vp = {"_raw": r.text[:400]}
            viewer = (vp.get("data") or {}).get("viewer") or {}
            add("auth_viewer", r.status_code == 200 and "errors" not in vp, {
                "status": r.status_code,
                "viewer": viewer.get("user"),
                "errors": vp.get("errors"),
                "body_preview": (r.text[:200] if "_raw" in vp else None),
            })
        except Exception as e:
            add("auth_viewer", False, error=f"{type(e).__name__}: {e}")
            return {"ok": False, "steps": steps}

        # 4) Posts query (12s timeout) — the actual thing ingest does
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=7)
        posts_q = """
        query Diag($a: DateTime, $b: DateTime) {
          posts(postedAfter: $a, postedBefore: $b, first: 5, order: NEWEST) {
            edges { node { id name tagline createdAt topics { edges { node { slug } } } } }
            pageInfo { hasNextPage }
          }
        }
        """
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                r = await client.post(
                    PH_GRAPHQL_URL,
                    headers={
                        "Authorization": f"Bearer {PH_TOKEN}",
                        "Content-Type": "application/json",
                        "User-Agent": USER_AGENT,
                    },
                    json={
                        "query": posts_q,
                        "variables": {
                            "a": start.isoformat().replace("+00:00", "Z"),
                            "b": end.isoformat().replace("+00:00", "Z"),
                        },
                    },
                )
            try:
                pp = r.json()
            except Exception:
                pp = {"_raw": r.text[:400]}
            posts = ((pp.get("data") or {}).get("posts") or {})
            edges = posts.get("edges") or []
            samples = []
            topics_seen: set = set()
            for e in edges:
                n = e.get("node") or {}
                t_slugs = [te["node"]["slug"] for te in (n.get("topics") or {}).get("edges", []) if te.get("node")]
                topics_seen.update(t_slugs)
                samples.append({
                    "name": n.get("name"),
                    "topics": t_slugs,
                    "matches_filter": any(t.lower() in {x.lower() for x in DEFAULT_SAAS_TOPICS} for t in t_slugs),
                })
            add("posts_query", r.status_code == 200 and "errors" not in pp, {
                "status": r.status_code,
                "posts_returned": len(edges),
                "errors": pp.get("errors"),
                "samples": samples,
                "topic_filter_hits": sum(1 for s in samples if s["matches_filter"]),
                "all_topics_seen": sorted(topics_seen),
                "body_preview": (r.text[:200] if "_raw" in pp else None),
            })
        except Exception as e:
            add("posts_query", False, error=f"{type(e).__name__}: {e}")

        all_ok = all(s["ok"] for s in steps)
        return {"ok": all_ok, "steps": steps}

    @router.get("/stats")
    async def get_stats(admin=Depends(admin_dep)):
        pipeline = [{"$group": {"_id": "$bucket", "count": {"$sum": 1}}}]
        buckets = {"green": 0, "yellow": 0, "red": 0, "unknown": 0}
        async for row in db.saas_radar_products.aggregate(pipeline):
            key = row["_id"] or "unknown"
            buckets[key] = row["count"]
        total = sum(buckets.values())
        last_ingest = await db.saas_radar_jobs.find_one(
            {"kind": "ingest", "status": {"$in": ["done", "error", "cancelled"]}},
            sort=[("updated_at", -1)],
            projection={"_id": 0},
        )
        last_enrich = await db.saas_radar_jobs.find_one(
            {"kind": "enrich", "status": {"$in": ["done", "error", "cancelled"]}},
            sort=[("updated_at", -1)],
            projection={"_id": 0},
        )
        with_emails = await db.saas_radar_products.count_documents({"emails_found.0": {"$exists": True}})

        # Verdict counts
        verdict_counts = {"customer": 0, "later": 0, "sent": 0, "pass": 0}
        async for row in db.saas_radar_products.aggregate([
            {"$match": {"verdict": {"$in": list(verdict_counts.keys())}}},
            {"$group": {"_id": "$verdict", "count": {"$sum": 1}}},
        ]):
            verdict_counts[row["_id"]] = row["count"]

        return {
            "buckets": buckets,
            "total": total,
            "with_emails": with_emails,
            "verdicts": verdict_counts,
            "last_ingest": last_ingest,
            "last_enrich": last_enrich,
        }

    @router.post("/ingest")
    async def ingest(req: IngestRequest, background_tasks: BackgroundTasks, admin=Depends(admin_dep)):
        if not PH_TOKEN:
            raise HTTPException(status_code=400, detail="PRODUCTHUNT_TOKEN not configured")
        # Reap any orphaned (stale) running jobs first so we don't false-positive
        # block when a previous worker died mid-flight.
        await _reap_stale_jobs(db)
        # If a *live* ingest is still running, refuse — stacking jobs doubles
        # event-loop pressure and only makes things worse.
        running = await db.saas_radar_jobs.find_one(
            {"kind": "ingest", "status": "running"},
            projection={"_id": 0, "id": 1, "created_at": 1},
        )
        if running:
            raise HTTPException(
                status_code=503,
                detail={
                    "kind": "ingest",
                    "message": "An ingest job is already running. Wait for it to finish or use /cancel-stuck if you believe it's hung.",
                    "running_job_id": running.get("id"),
                },
            )
        topics = req.topics or DEFAULT_SAAS_TOPICS
        job_id = await _create_job(db, "ingest", {"days_back": req.days_back, "topics": topics})
        # Tier C: run on a dedicated thread+loop so the API loop stays responsive.
        start_radar_worker(lambda worker_db: _bg_ingest(worker_db, req.days_back, topics, job_id))
        return {"job_id": job_id, "status": "running"}

    @router.post("/enrich")
    async def enrich(req: EnrichRequest, background_tasks: BackgroundTasks, admin=Depends(admin_dep)):
        # Reap any orphaned (stale) running jobs first so we don't false-positive
        # block when a previous worker died mid-flight.
        await _reap_stale_jobs(db)
        # If a *live* enrich is still running, refuse — stacking jobs doubles
        # event-loop pressure and only makes the worker more unresponsive.
        running = await db.saas_radar_jobs.find_one(
            {"kind": "enrich", "status": "running"},
            projection={"_id": 0, "id": 1, "created_at": 1},
        )
        if running:
            raise HTTPException(
                status_code=503,
                detail={
                    "kind": "enrich",
                    "message": "An enrich job is already running. Wait for it to finish or use /cancel-stuck if you believe it's hung.",
                    "running_job_id": running.get("id"),
                },
            )
        job_id = await _create_job(db, "enrich", {"limit": req.limit, "use_llm": req.use_llm, "use_playwright": req.use_playwright})
        # Tier C: run on a dedicated thread+loop so the API loop stays responsive.
        start_radar_worker(lambda worker_db: _bg_enrich(worker_db, req.limit, req.use_llm, req.use_playwright, job_id))
        return {"job_id": job_id, "status": "running"}

    @router.post("/cancel-stuck")
    async def cancel_stuck(admin=Depends(admin_dep)):
        """Manual override — mark ALL currently 'running' jobs as cancelled.
        Use this if the UI is stuck on Running… after a deploy."""
        res = await db.saas_radar_jobs.update_many(
            {"status": "running"},
            {"$set": {
                "status": "cancelled",
                "error": "Manually cancelled by admin (orphaned after deploy/restart).",
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        return {"cancelled": res.modified_count}

    @router.get("/jobs")
    async def list_jobs(limit: int = Query(20, ge=1, le=100), admin=Depends(admin_dep)):
        await _reap_stale_jobs(db)
        jobs = await db.saas_radar_jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return {"jobs": jobs}

    # Platform-app preset for "Hide platform apps" toggle.
    # Matched case-insensitively with word boundaries against name/tagline/website/topics.
    PLATFORM_APP_KEYWORDS = [
        "shopify", "chrome extension", "wordpress", "ios", "android",
        "figma plugin", "firefox extension", "browser extension",
        "safari extension", "edge extension", "mobile app",
    ]

    def _kw_regex_clauses(keywords: List[str]) -> List[Dict[str, Any]]:
        """Build a list of $or clauses (to be inverted into $nor) so a product is
        EXCLUDED if any keyword appears in name/tagline/website_url/topics."""
        clauses: List[Dict[str, Any]] = []
        for kw in keywords:
            kw = (kw or "").strip()
            if not kw:
                continue
            # Word-boundary match so "ios" doesn't match "scenario".
            # Allow multi-word phrases ("chrome extension") by escaping then
            # collapsing whitespace to \s+.
            esc = re.escape(kw)
            esc = re.sub(r"\\\s+", r"\\s+", esc)
            rx = rf"(?i)\b{esc}\b"
            clauses.append({"name": {"$regex": rx}})
            clauses.append({"tagline": {"$regex": rx}})
            clauses.append({"website_url": {"$regex": rx}})
            # topics is an array of slugs — use $elemMatch with regex.
            clauses.append({"topics": {"$elemMatch": {"$regex": rx}}})
        return clauses

    def _build_products_query(
        bucket: Optional[str],
        verdict: Optional[str],
        outreach_status: Optional[str],
        search: Optional[str],
        has_email: Optional[bool],
        topics_csv: Optional[str],
        exclude_csv: Optional[str],
        hide_platform_apps: Optional[bool],
    ) -> Dict[str, Any]:
        """Single source of truth for the list_products + topic_counts queries."""
        query: Dict[str, Any] = {}
        ors: List[List[Dict[str, Any]]] = []  # collected $or groups to AND together

        if bucket:
            buckets = [b.strip() for b in bucket.split(",") if b.strip()]
            if buckets:
                query["bucket"] = {"$in": buckets}
        if outreach_status:
            statuses = [s.strip() for s in outreach_status.split(",") if s.strip()]
            if statuses:
                if "unset" in statuses:
                    set_s = [s for s in statuses if s != "unset"]
                    if set_s:
                        ors.append([
                            {"outreach_status": {"$in": set_s}},
                            {"outreach_status": None},
                            {"outreach_status": {"$exists": False}},
                        ])
                    else:
                        ors.append([
                            {"outreach_status": None},
                            {"outreach_status": {"$exists": False}},
                        ])
                else:
                    query["outreach_status"] = {"$in": statuses}
        if verdict:
            verdicts = [v.strip() for v in verdict.split(",") if v.strip()]
            if verdicts:
                if "unset" in verdicts:
                    set_v = [v for v in verdicts if v != "unset"]
                    if set_v:
                        ors.append([
                            {"verdict": {"$in": set_v}},
                            {"verdict": None},
                            {"verdict": {"$exists": False}},
                        ])
                    else:
                        ors.append([
                            {"verdict": None},
                            {"verdict": {"$exists": False}},
                        ])
                else:
                    query["verdict"] = {"$in": verdicts}
        if search:
            rx = re.escape(search)
            ors.append([
                {"name": {"$regex": rx, "$options": "i"}},
                {"tagline": {"$regex": rx, "$options": "i"}},
                {"website_url": {"$regex": rx, "$options": "i"}},
            ])
        if has_email:
            query["emails_found.0"] = {"$exists": True}

        # Topic filter: ANY of selected topics matches (intuitive multi-select OR).
        if topics_csv:
            topic_slugs = [t.strip().lower() for t in topics_csv.split(",") if t.strip()]
            if topic_slugs:
                query["topics"] = {"$in": topic_slugs}

        # Exclude keywords (user-typed + preset toggle).
        all_excludes: List[str] = []
        if exclude_csv:
            all_excludes.extend([k.strip() for k in exclude_csv.split(",") if k.strip()])
        if hide_platform_apps:
            all_excludes.extend(PLATFORM_APP_KEYWORDS)
        if all_excludes:
            nor_clauses = _kw_regex_clauses(all_excludes)
            if nor_clauses:
                query["$nor"] = nor_clauses

        # Merge collected $or groups using $and so they all apply.
        if ors:
            if len(ors) == 1:
                query["$or"] = ors[0]
            else:
                query["$and"] = [{"$or": group} for group in ors]
        return query

    @router.get("/products")
    async def list_products(
        bucket: Optional[str] = Query(None),
        verdict: Optional[str] = Query(None),
        outreach_status: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        has_email: Optional[bool] = Query(None),
        topics: Optional[str] = Query(None),
        exclude: Optional[str] = Query(None),
        hide_platform_apps: Optional[bool] = Query(None),
        sort: str = Query("score_desc"),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        admin=Depends(admin_dep),
    ):
        query = _build_products_query(
            bucket, verdict, outreach_status, search, has_email,
            topics, exclude, hide_platform_apps,
        )

        sort_map = {
            "score_desc": [("score", -1), ("posted_at", -1)],
            "posted_desc": [("posted_at", -1)],
            "posted_asc": [("posted_at", 1)],
            "votes_desc": [("votes_count", -1)],
            "name_asc": [("name", 1)],
        }
        sort_spec = sort_map.get(sort, sort_map["score_desc"])
        total = await db.saas_radar_products.count_documents(query)
        cursor = db.saas_radar_products.find(query, {"_id": 0}).sort(sort_spec).skip(offset).limit(limit)
        products = await cursor.to_list(limit)
        return {"products": products, "total": total, "limit": limit, "offset": offset}

    @router.patch("/products/{ph_id}/verdict")
    async def set_verdict(ph_id: str, req: VerdictRequest, admin=Depends(admin_dep)):
        v = req.verdict if req.verdict else None
        if v not in VALID_VERDICTS:
            raise HTTPException(status_code=400, detail=f"Invalid verdict. Allowed: {sorted([x for x in VALID_VERDICTS if x])}")
        res = await db.saas_radar_products.update_one(
            {"ph_id": ph_id},
            {"$set": {
                "verdict": v or None,
                "verdict_updated_at": datetime.now(timezone.utc) if v else None,
            }},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "verdict": v}

    @router.patch("/products/{ph_id}/outreach-status")
    async def set_outreach_status(ph_id: str, req: UpdateFounderOutreachStatusInput, admin=Depends(admin_dep)):
        """Update founder outreach status. Every call appends an entry to
        contact_log with {timestamp, status, note}. Pass an empty/null note for
        a pure status-change event; pass a non-empty note to log a contact note
        against the current/new status."""
        if req.status not in VALID_OUTREACH_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {sorted(VALID_OUTREACH_STATUSES)}")
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": req.status,
            "note": req.note or "",
        }
        res = await db.saas_radar_products.update_one(
            {"ph_id": ph_id},
            {
                "$set": {"outreach_status": req.status},
                "$push": {"contact_log": log_entry},
            },
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "status": req.status, "log_entry": log_entry}

    @router.patch("/products/{ph_id}/follow-up-date")
    async def set_follow_up_date(ph_id: str, req: UpdateFounderFollowUpDateInput, admin=Depends(admin_dep)):
        res = await db.saas_radar_products.update_one(
            {"ph_id": ph_id},
            {"$set": {"follow_up_date": req.follow_up_date.isoformat() if req.follow_up_date else None}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "follow_up_date": req.follow_up_date.isoformat() if req.follow_up_date else None}

    @router.patch("/products/{ph_id}/notes")
    async def set_notes(ph_id: str, req: UpdateFounderNotesInput, admin=Depends(admin_dep)):
        res = await db.saas_radar_products.update_one(
            {"ph_id": ph_id},
            {"$set": {"outreach_notes": req.outreach_notes}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True}

    @router.get("/topic-counts")
    async def topic_counts(
        bucket: Optional[str] = Query(None),
        verdict: Optional[str] = Query(None),
        outreach_status: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        has_email: Optional[bool] = Query(None),
        exclude: Optional[str] = Query(None),
        hide_platform_apps: Optional[bool] = Query(None),
        limit: int = Query(150, ge=1, le=500),
        admin=Depends(admin_dep),
    ):
        """Return topic slugs + counts for products matching current filters
        (excluding the topics filter itself, so users can see what's available).
        Sorted by count desc."""
        match_query = _build_products_query(
            bucket, verdict, outreach_status, search, has_email,
            None,  # don't apply topic filter
            exclude, hide_platform_apps,
        )
        pipeline = [
            {"$match": match_query},
            {"$unwind": "$topics"},
            {"$group": {"_id": "$topics", "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id": 1}},
            {"$limit": limit},
        ]
        cursor = db.saas_radar_products.aggregate(pipeline)
        rows = await cursor.to_list(length=limit)
        return {
            "topics": [
                {"slug": r["_id"], "count": r["count"]} for r in rows if r.get("_id")
            ]
        }

    @router.get("/products.csv")
    async def export_csv(
        bucket: Optional[str] = Query(None),
        verdict: Optional[str] = Query(None),
        outreach_status: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        has_email: Optional[bool] = Query(None),
        topics: Optional[str] = Query(None),
        exclude: Optional[str] = Query(None),
        hide_platform_apps: Optional[bool] = Query(None),
        admin=Depends(admin_dep),
    ):
        query = _build_products_query(
            bucket, verdict, outreach_status, search, has_email,
            topics, exclude, hide_platform_apps,
        )
        cursor = db.saas_radar_products.find(query, {"_id": 0}).sort([("score", -1), ("posted_at", -1)])
        rows = await cursor.to_list(length=5000)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "name", "tagline", "website", "ph_url", "bucket", "score",
            "verdict",
            "has_pricing", "multiple_paid_tiers", "has_affiliate_program",
            "affiliate_platform", "affiliate_program_url", "pricing_url",
            "emails", "makers", "twitter_handles", "topics", "votes", "posted_at",
        ])
        for r in rows:
            makers = r.get("makers") or []
            writer.writerow([
                r.get("name") or "",
                r.get("tagline") or "",
                r.get("website_url") or "",
                r.get("ph_url") or "",
                r.get("bucket") or "",
                r.get("score") or 0,
                r.get("verdict") or "",
                "yes" if r.get("has_pricing") else "no",
                "yes" if r.get("multiple_paid_tiers") else "no",
                "yes" if r.get("has_affiliate_program") else "no",
                r.get("affiliate_platform_detected") or "",
                r.get("affiliate_program_url") or "",
                r.get("pricing_url") or "",
                "; ".join(r.get("emails_found") or []),
                "; ".join([m.get("name") or m.get("username") or "" for m in makers]),
                "; ".join([m.get("twitter_username") for m in makers if m.get("twitter_username")]),
                ", ".join(r.get("topics") or []),
                r.get("votes_count") or 0,
                r.get("posted_at").isoformat() if isinstance(r.get("posted_at"), datetime) else "",
            ])
        buf.seek(0)
        filename = f"saas-radar-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    @router.delete("/products/{ph_id}")
    async def delete_product(ph_id: str, admin=Depends(admin_dep)):
        res = await db.saas_radar_products.delete_one({"ph_id": ph_id})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True}

    return router
