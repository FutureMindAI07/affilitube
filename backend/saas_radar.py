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
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
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
EMAIL_BLACKLIST_SUBSTRINGS = (
    "sentry", "wixpress", "example.com", "yourdomain", "domain.com",
    ".png", ".jpg", ".webp", ".svg", "sentry.io",
)

# Concurrency limits.
WEBSITE_CHECK_CONCURRENCY = 6
WEBSITE_FETCH_TIMEOUT = 12.0
USER_AGENT = "Mozilla/5.0 (compatible; AffiliTube-SaaSRadar/1.0; +https://affilitube.com)"


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
    first: 50
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
) -> Tuple[int, int]:
    """Single-stream ingest for a date window. Filters topics LOCALLY post-fetch,
    so we don't burn 10x complexity points doing one query per topic.

    Returns (total_seen, total_new).
    """
    seen = 0
    new = 0
    topic_set = {t.lower() for t in topics_filter} if topics_filter else None
    after_cursor = None
    page = 0
    while True:
        page += 1
        try:
            conn = await ph_fetch_posts(posted_after, posted_before, after_cursor)
        except PHRateLimitError as e:
            # Persist progress + bubble up so the job can mark itself partial
            logger.warning("Rate limited mid-ingest, sleeping %ss", e.reset_in)
            await asyncio.sleep(min(e.reset_in + 5, 900))
            continue
        except PHClientError as e:
            logger.warning("PH fetch failed page=%s: %s", page, e)
            if "401" in str(e):
                raise
            await asyncio.sleep(5)
            break

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

        page_info = conn.get("pageInfo") or {}
        if not page_info.get("hasNextPage"):
            break
        after_cursor = page_info.get("endCursor")
        # Small breather between pages.
        await asyncio.sleep(0.4)

    return seen, new


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


async def _fetch_html(client: httpx.AsyncClient, url: str) -> Tuple[Optional[int], str, Optional[str]]:
    """GET a URL, return (status, text, final_url). text='' on failure."""
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
        # Filter obvious image/asset filename matches that the regex picked up.
        if m_low.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")):
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


async def enrich_one_product(client: httpx.AsyncClient, product: Dict[str, Any]) -> Dict[str, Any]:
    """Visit the product website, gather signals, compute bucket + score.

    Returns the update document (without _id / ph_id), suitable for $set.
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
    status, home_html, final_url = await _fetch_html(client, website)
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
        s, h, fu = await _fetch_html(client, candidate)
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
        s, h, fu = await _fetch_html(client, candidate)
        if s and s < 400 and h:
            pages_html.append(h)
            platform = _detect_affiliate_platform(h)
            if platform or AFFILIATE_KEYWORDS_RX.search(h):
                aff_url = fu or candidate
                aff_platform = platform
                break

    combined_html = "\n".join(pages_html)

    # Affiliate detection from combined html
    if not aff_platform:
        aff_platform = _detect_affiliate_platform(combined_html)
    if not aff_url:
        aff_url = _find_affiliate_link_in_html(combined_html, final_url or website)

    has_affiliate = bool(aff_platform) or bool(aff_url) or bool(
        AFFILIATE_KEYWORDS_RX.search(combined_html)
    )

    # Pricing detection
    has_pricing = bool(pricing_url) or bool(PRICING_KEYWORDS_RX.search(combined_html))
    tier_count = _count_paid_tiers(combined_html)

    # Emails
    emails = _extract_emails(combined_html, domain)

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


async def enrich_pending_products(db, limit: int = 200) -> Dict[str, int]:
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
    async with httpx.AsyncClient(
        timeout=WEBSITE_FETCH_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        async def _process(p):
            async with sem:
                try:
                    update = await enrich_one_product(client, p)
                except Exception as e:
                    logger.warning("enrich error for %s: %s", p.get("website_url"), e)
                    update = {
                        "site_checked_at": datetime.now(timezone.utc),
                        "site_status": None,
                        "bucket": "unknown",
                        "score": 0,
                        "notes": ["enrich_exception"],
                    }
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
    return counts


# ============================================================================
# Job tracking
# ============================================================================

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


async def _bg_ingest(db, days_back: int, topics_filter: List[str], job_id: str):
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days_back)
        seen, new = await ph_ingest_window(db, start, end, topics_filter, job_id)
        await _finish_job(db, job_id, {"seen": seen, "new": new, "days_back": days_back})
    except Exception as e:
        logger.exception("ingest job failed")
        await _finish_job(db, job_id, {}, error=str(e))


async def _bg_enrich(db, limit: int, job_id: str):
    try:
        counts = await enrich_pending_products(db, limit=limit)
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
        """Run a tiny PH query (last 7 days, no topic filter, first 5 posts) and
        return everything we can see: HTTP status, errors, raw counts, sample names.
        Used to figure out why ingest returns 0 from production."""
        if not PH_TOKEN:
            return {"ok": False, "stage": "config", "error": "PRODUCTHUNT_TOKEN not configured"}
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=7)
        # Run a small custom query
        query = """
        query Diag($postedAfter: DateTime, $postedBefore: DateTime) {
          posts(postedAfter: $postedAfter, postedBefore: $postedBefore, first: 5, order: NEWEST) {
            edges { node { id name tagline website createdAt topics { edges { node { slug } } } } }
            pageInfo { hasNextPage endCursor }
          }
        }
        """
        variables = {
            "postedAfter": start.isoformat().replace("+00:00", "Z"),
            "postedBefore": end.isoformat().replace("+00:00", "Z"),
        }
        headers = {
            "Authorization": f"Bearer {PH_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(PH_GRAPHQL_URL, headers=headers, json={"query": query, "variables": variables})
            result = {
                "ok": resp.status_code == 200,
                "stage": "ph_response",
                "http_status": resp.status_code,
                "window_days": 7,
                "default_topics_count": len(DEFAULT_SAAS_TOPICS),
            }
            try:
                payload = resp.json()
            except Exception as e:
                result["error"] = f"JSON parse failed: {e}"
                result["raw_body_preview"] = resp.text[:400]
                return result

            if "errors" in payload:
                result["graphql_errors"] = payload["errors"]
            posts = (payload.get("data") or {}).get("posts") or {}
            edges = posts.get("edges") or []
            result["posts_returned"] = len(edges)
            result["has_next_page"] = (posts.get("pageInfo") or {}).get("hasNextPage")
            samples = []
            topics_seen = set()
            for e in edges:
                n = e.get("node") or {}
                t_slugs = [te["node"]["slug"] for te in (n.get("topics") or {}).get("edges", []) if te.get("node")]
                topics_seen.update(t_slugs)
                samples.append({
                    "name": n.get("name"),
                    "tagline": (n.get("tagline") or "")[:60],
                    "topics": t_slugs,
                    "matches_filter": any(t.lower() in {x.lower() for x in DEFAULT_SAAS_TOPICS} for t in t_slugs),
                })
            result["samples"] = samples
            result["all_topics_seen"] = sorted(topics_seen)
            result["topic_filter_hits"] = sum(1 for s in samples if s["matches_filter"])
            return result
        except Exception as e:
            return {"ok": False, "stage": "request", "error": str(e)}

    @router.get("/stats")
    async def get_stats(admin=Depends(admin_dep)):
        pipeline = [{"$group": {"_id": "$bucket", "count": {"$sum": 1}}}]
        buckets = {"green": 0, "yellow": 0, "red": 0, "unknown": 0}
        async for row in db.saas_radar_products.aggregate(pipeline):
            key = row["_id"] or "unknown"
            buckets[key] = row["count"]
        total = sum(buckets.values())
        last_ingest = await db.saas_radar_jobs.find_one(
            {"kind": "ingest", "status": "done"},
            sort=[("updated_at", -1)],
            projection={"_id": 0},
        )
        last_enrich = await db.saas_radar_jobs.find_one(
            {"kind": "enrich", "status": "done"},
            sort=[("updated_at", -1)],
            projection={"_id": 0},
        )
        with_emails = await db.saas_radar_products.count_documents({"emails_found.0": {"$exists": True}})
        return {
            "buckets": buckets,
            "total": total,
            "with_emails": with_emails,
            "last_ingest": last_ingest,
            "last_enrich": last_enrich,
        }

    @router.post("/ingest")
    async def ingest(req: IngestRequest, background_tasks: BackgroundTasks, admin=Depends(admin_dep)):
        if not PH_TOKEN:
            raise HTTPException(status_code=400, detail="PRODUCTHUNT_TOKEN not configured")
        topics = req.topics or DEFAULT_SAAS_TOPICS
        job_id = await _create_job(db, "ingest", {"days_back": req.days_back, "topics": topics})
        background_tasks.add_task(_bg_ingest, db, req.days_back, topics, job_id)
        return {"job_id": job_id, "status": "running"}

    @router.post("/enrich")
    async def enrich(req: EnrichRequest, background_tasks: BackgroundTasks, admin=Depends(admin_dep)):
        job_id = await _create_job(db, "enrich", {"limit": req.limit})
        background_tasks.add_task(_bg_enrich, db, req.limit, job_id)
        return {"job_id": job_id, "status": "running"}

    @router.get("/jobs")
    async def list_jobs(limit: int = Query(20, ge=1, le=100), admin=Depends(admin_dep)):
        jobs = await db.saas_radar_jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
        return {"jobs": jobs}

    @router.get("/products")
    async def list_products(
        bucket: Optional[str] = Query(None),
        search: Optional[str] = Query(None),
        has_email: Optional[bool] = Query(None),
        sort: str = Query("score_desc"),
        limit: int = Query(50, ge=1, le=200),
        offset: int = Query(0, ge=0),
        admin=Depends(admin_dep),
    ):
        query: Dict[str, Any] = {}
        if bucket:
            buckets = [b.strip() for b in bucket.split(",") if b.strip()]
            if buckets:
                query["bucket"] = {"$in": buckets}
        if search:
            rx = re.escape(search)
            query["$or"] = [
                {"name": {"$regex": rx, "$options": "i"}},
                {"tagline": {"$regex": rx, "$options": "i"}},
                {"website_url": {"$regex": rx, "$options": "i"}},
            ]
        if has_email:
            query["emails_found.0"] = {"$exists": True}

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

    @router.get("/products.csv")
    async def export_csv(
        bucket: Optional[str] = Query(None),
        has_email: Optional[bool] = Query(None),
        admin=Depends(admin_dep),
    ):
        query: Dict[str, Any] = {}
        if bucket:
            buckets = [b.strip() for b in bucket.split(",") if b.strip()]
            if buckets:
                query["bucket"] = {"$in": buckets}
        if has_email:
            query["emails_found.0"] = {"$exists": True}
        cursor = db.saas_radar_products.find(query, {"_id": 0}).sort([("score", -1), ("posted_at", -1)])
        rows = await cursor.to_list(length=5000)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "name", "tagline", "website", "ph_url", "bucket", "score",
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
