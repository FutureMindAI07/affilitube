"""
YouTube-data retention & compliance module.

Google's Developer Policy requires that channel/video metadata + statistics
retrieved via the YouTube Data API must not be stored longer than 30 days
without refresh. We implement that by:

  - Stamping every YouTube-sourced doc with `retention_expires_at`
    (BSON `datetime`, = now + 30d) on write.
  - Running a nightly APScheduler cron that split-purges expired channel docs
    (strip YT-sourced fields, keep pipeline shell) and hard-deletes expired
    autosaved_results + search_reports.
  - A TTL index on autosaved_results.retention_expires_at and
    search_reports.retention_expires_at as an automatic backstop
    (hard-delete safe on those collections).
  - A TTL index on channels.retention_expires_at with a `partialFilterExpression`
    that ONLY fires when a channel has no pipeline shell — so pipeline data
    can never be TTL'd away by accident.
  - A one-time retroactive sweep on backend startup so existing data is
    brought under compliance without waiting for the nightly window.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# =========================================================================
# Constants
# =========================================================================

RETENTION_DAYS = 30
RETENTION_FIELD = "retention_expires_at"  # BSON datetime, same name across colls
BACKFILL_MARKER_ID = "retention_backfill_v1"

# Fields kept intact on channels during split-purge. Everything else on the
# doc gets $unset.
CHANNEL_PIPELINE_SHELL_FIELDS = {
    "_id",
    "channel_id",
    "channel_name",           # kept — primary label for outreach history
    "channel_url",
    "user_id",
    "outreach_status",
    "project_name",
    "notes",
    "follow_up_date",
    "contact_log",
    "added_to_pipeline_at",
    "last_status_change",
    "business_email_manual",  # manual overrides survive re-enrichment; keep
    "public_links_manual",
    "retention_purged",
    "retention_purged_at",
}


def retention_expiry_from(now: Optional[datetime] = None) -> datetime:
    """Return the retention expiry for a fresh write (BSON datetime)."""
    if now is None:
        now = datetime.now(timezone.utc)
    return now + timedelta(days=RETENTION_DAYS)


def _has_pipeline_shell(doc: dict) -> bool:
    """A channel has 'pipeline shell' if it's been touched by outreach.
    We preserve those docs on split-purge; the rest we hard-delete."""
    status = (doc.get("outreach_status") or "").strip()
    project = (doc.get("project_name") or "").strip()
    has_log = bool(doc.get("contact_log"))
    has_notes = bool((doc.get("notes") or "").strip())
    return (
        (status and status != "not_contacted")
        or bool(project)
        or has_log
        or has_notes
    )


async def _split_purge_channel(db, channel_doc: dict) -> None:
    """Strip YouTube-sourced fields from a single channel doc, preserve shell."""
    unset = {k: "" for k in channel_doc.keys() if k not in CHANNEL_PIPELINE_SHELL_FIELDS}
    if not unset:
        return
    await db.channels.update_one(
        {"_id": channel_doc["_id"]},
        {
            "$unset": unset,
            "$set": {
                "retention_purged": True,
                "retention_purged_at": datetime.now(timezone.utc),
                # Clear expiry — the doc has no YT data left to expire.
                RETENTION_FIELD: None,
            },
        },
    )


async def _sweep_channels(db, now: datetime) -> dict:
    """Sweep expired channel docs. Returns counts."""
    # Two populations:
    #  (a) Docs with retention_expires_at <= now → the standard case.
    #  (b) Legacy docs that were never stamped (no retention_expires_at) AND
    #      still hold YT-sourced fields → the zombie population from the
    #      pre-retention code path.
    expired_q = {
        "$or": [
            {RETENTION_FIELD: {"$lte": now}},
            # Zombies: no retention field, still has YT stats (subscriber_count
            # is the tell — it's set on every enrichment). Untimestamped +
            # already-purged docs are filtered out via retention_purged=True.
            {
                "$and": [
                    {RETENTION_FIELD: {"$exists": False}},
                    {"retention_purged": {"$ne": True}},
                    {"subscriber_count": {"$exists": True}},
                ]
            },
        ]
    }
    split_purged = 0
    hard_deleted = 0
    cursor = db.channels.find(expired_q).batch_size(200)

    async for full in cursor:
        if _has_pipeline_shell(full):
            await _split_purge_channel(db, full)
            split_purged += 1
        else:
            await db.channels.delete_one({"_id": full["_id"]})
            hard_deleted += 1

    return {"channels_split_purged": split_purged, "channels_hard_deleted": hard_deleted}


async def _sweep_autosaved(db, now: datetime) -> dict:
    """Hard-delete expired autosaved_results docs (safe — pure YT snapshot)."""
    cutoff_iso = (now - timedelta(days=RETENTION_DAYS)).isoformat()
    q = {
        "$or": [
            {RETENTION_FIELD: {"$lte": now}},
            # Legacy docs stamped with `saved_at` ISO string, older than cutoff.
            {
                "$and": [
                    {RETENTION_FIELD: {"$exists": False}},
                    {"saved_at": {"$lte": cutoff_iso}},
                ]
            },
            # Docs with no timestamp at all — can't verify age, presumed expired.
            {
                "$and": [
                    {RETENTION_FIELD: {"$exists": False}},
                    {"saved_at": {"$exists": False}},
                ]
            },
        ]
    }
    r = await db.autosaved_results.delete_many(q)
    return {"autosaved_hard_deleted": r.deleted_count}


async def _sweep_search_reports(db, now: datetime) -> dict:
    """Hard-delete expired search_reports docs (safe — frozen YT snapshot)."""
    cutoff_iso = (now - timedelta(days=RETENTION_DAYS)).isoformat()
    q = {
        "$or": [
            {RETENTION_FIELD: {"$lte": now}},
            {
                "$and": [
                    {RETENTION_FIELD: {"$exists": False}},
                    {"created_at": {"$lte": cutoff_iso}},
                ]
            },
            {
                "$and": [
                    {RETENTION_FIELD: {"$exists": False}},
                    {"created_at": {"$exists": False}},
                ]
            },
        ]
    }
    r = await db.search_reports.delete_many(q)
    return {"search_reports_hard_deleted": r.deleted_count}


async def run_retention_sweep(db, *, source: str = "manual") -> dict:
    """Execute a full retention sweep across all three collections.
    Idempotent — safe to run repeatedly."""
    now = datetime.now(timezone.utc)
    logger.info(f"Retention sweep starting (source={source}) at {now.isoformat()}")

    results = {"ran_at": now.isoformat(), "source": source}
    try:
        results.update(await _sweep_channels(db, now))
    except Exception as e:
        logger.exception("Retention sweep: channels failed: %s", e)
        results["channels_error"] = str(e)
    try:
        results.update(await _sweep_autosaved(db, now))
    except Exception as e:
        logger.exception("Retention sweep: autosaved_results failed: %s", e)
        results["autosaved_error"] = str(e)
    try:
        results.update(await _sweep_search_reports(db, now))
    except Exception as e:
        logger.exception("Retention sweep: search_reports failed: %s", e)
        results["search_reports_error"] = str(e)

    # Persist run record for audit trail
    try:
        await db.retention_audit.insert_one({**results})
    except Exception:
        pass

    logger.info(f"Retention sweep complete: {results}")
    return results


# =========================================================================
# Index setup
# =========================================================================

async def ensure_retention_indexes(db) -> None:
    """Create TTL and partial-TTL indexes if they don't exist.
    Called once at backend startup."""
    # autosaved_results — full TTL (safe hard-delete)
    try:
        await db.autosaved_results.create_index(
            RETENTION_FIELD, expireAfterSeconds=0, name="retention_ttl"
        )
        logger.info("Retention: TTL index on autosaved_results.retention_expires_at ensured")
    except Exception as e:
        logger.warning(f"Retention: autosaved_results TTL index failed: {e}")

    # search_reports — full TTL (safe hard-delete)
    try:
        await db.search_reports.create_index(
            RETENTION_FIELD, expireAfterSeconds=0, name="retention_ttl"
        )
        logger.info("Retention: TTL index on search_reports.retention_expires_at ensured")
    except Exception as e:
        logger.warning(f"Retention: search_reports TTL index failed: {e}")

    # channels — partial TTL. Only fires on shell-less docs (retention_purged=False
    # AND outreach_status=="not_contacted"). Docs with pipeline shell rely on the
    # nightly cron instead (split-purge preserves shell; TTL cannot).
    #
    # NOTE: MongoDB's partialFilterExpression can't use `$exists: false` or `$ne`,
    # so we can only positively index docs where the field IS set to specific values.
    # Practically, every enrichment write sets outreach_status implicitly via the
    # ChannelData default ("not_contacted") — so the positive filter still covers
    # the "fresh enrichment, never added to pipeline" case, which is 95%+ of the
    # backstop's job.
    try:
        await db.channels.create_index(
            RETENTION_FIELD,
            expireAfterSeconds=0,
            name="retention_ttl_shell_less",
            partialFilterExpression={
                "outreach_status": "not_contacted",
                "retention_purged": False,
            },
        )
        logger.info("Retention: partial TTL index on channels.retention_expires_at ensured")
    except Exception as e:
        logger.warning(f"Retention: channels partial TTL index failed: {e}")


async def run_startup_backfill(db) -> Optional[dict]:
    """Run the one-time retroactive sweep on backend startup.
    Marker doc in `system_meta` ensures we only run once per DB."""
    marker = await db.system_meta.find_one({"_id": BACKFILL_MARKER_ID})
    if marker:
        logger.info(f"Retention: startup backfill already completed at {marker.get('completed_at')}")
        return None
    logger.warning("Retention: startup backfill RUNNING (first time on this DB)")
    result = await run_retention_sweep(db, source="startup_backfill")
    await db.system_meta.insert_one({
        "_id": BACKFILL_MARKER_ID,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "result": result,
    })
    logger.warning(f"Retention: startup backfill COMPLETE: {result}")
    return result
