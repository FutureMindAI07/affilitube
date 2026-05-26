"""
Tests for 14-day Starter trial signup flow.
Covers:
- POST /api/auth/register with/without trial param
- GET /api/auth/me returns trial fields (is_trial, tier, access_expires_at)
- GET /api/user/usage returns trial_days_remaining and csv_export=false for trial user
- POST /api/export/csv returns 403 'upgrade_required' for trial user
- Auto-downgrade when access_expires_at is in past
"""
import os
import time
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fall back to reading from frontend/.env directly
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

UNIQUE = int(time.time())
TRIAL_EMAIL = f"trial_test_{UNIQUE}@example.com"
FREE_EMAIL = f"free_test_{UNIQUE}@example.com"
PASSWORD = "password123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def trial_user(session):
    """Register a NEW user with trial=starter_14"""
    r = session.post(f"{API}/auth/register", json={
        "email": TRIAL_EMAIL,
        "password": PASSWORD,
        "trial": "starter_14",
    })
    assert r.status_code == 200, f"register trial failed: {r.status_code} {r.text}"
    data = r.json()
    return data


@pytest.fixture(scope="module")
def free_user(session):
    """Register a NEW user without trial param"""
    r = session.post(f"{API}/auth/register", json={
        "email": FREE_EMAIL,
        "password": PASSWORD,
    })
    assert r.status_code == 200, f"register free failed: {r.status_code} {r.text}"
    return r.json()


# ---------- Registration ----------

class TestRegistration:
    def test_register_with_trial_param_creates_starter_trial(self, trial_user):
        assert "token" in trial_user
        assert "user" in trial_user
        u = trial_user["user"]
        assert u["email"] == TRIAL_EMAIL
        assert u["tier"] == "starter", f"expected starter, got {u.get('tier')}"
        assert u["is_trial"] is True, f"expected is_trial=true, got {u.get('is_trial')}"

    def test_register_without_trial_param_is_free(self, free_user):
        u = free_user["user"]
        assert u["tier"] == "free"
        # is_trial should be false / absent
        assert not u.get("is_trial", False)


# ---------- /auth/me ----------

class TestAuthMe:
    def test_auth_me_trial_user(self, session, trial_user):
        token = trial_user["token"]
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("tier") == "starter"
        assert d.get("is_trial") is True
        # access_expires_at should exist and ~14 days out
        assert d.get("access_expires_at"), "access_expires_at missing"
        exp = datetime.fromisoformat(d["access_expires_at"])
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        delta = (exp - datetime.now(timezone.utc)).days
        assert 13 <= delta <= 14, f"expected ~14 days, got {delta}"

    def test_auth_me_free_user(self, session, free_user):
        token = free_user["token"]
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        d = r.json()
        assert d.get("tier") == "free"
        assert not d.get("is_trial", False)


# ---------- /user/usage (richer trial info) ----------

class TestUserUsage:
    def test_usage_trial_user_csv_disabled_and_days_remaining(self, session, trial_user):
        token = trial_user["token"]
        r = session.get(f"{API}/user/usage", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("tier") == "starter"
        assert d.get("is_trial") is True
        assert d.get("csv_export") is False, "trial user csv_export must be False"
        days = d.get("trial_days_remaining")
        assert days is not None
        assert 13 <= days <= 14, f"expected ~14 days remaining, got {days}"


# ---------- Export gating ----------

class TestExportGating:
    def test_trial_user_cannot_export_csv(self, session, trial_user):
        token = trial_user["token"]
        # POST /api/export/csv body is List[str]
        r = session.post(
            f"{API}/export/csv",
            json=["dummy_channel_id"],
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 403, f"expected 403 for trial export, got {r.status_code} {r.text}"
        body = r.json()
        # could be {"error": "upgrade_required", ...} OR {"detail": {"error": ...}}
        if "error" in body:
            assert body["error"] == "upgrade_required"
        elif "detail" in body and isinstance(body["detail"], dict):
            assert body["detail"].get("error") == "upgrade_required"
        else:
            pytest.fail(f"unexpected 403 body: {body}")


# ---------- Auto-downgrade simulation ----------

class TestAutoDowngrade:
    def test_expired_trial_auto_downgrades_to_free(self, session, trial_user):
        """Directly set access_expires_at in past via MongoDB, then call /auth/me."""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
        except Exception:
            pytest.skip("motor not available")

        mongo_url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
        db_name = os.environ.get("DB_NAME") or "affilitube_db"

        user_id = trial_user["user"]["id"]

        async def expire():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
            res = await db.users.update_one(
                {"id": user_id},
                {"$set": {"access_expires_at": past}}
            )
            client.close()
            return res.modified_count

        modified = asyncio.get_event_loop().run_until_complete(expire())
        assert modified == 1, "failed to set access_expires_at in past"

        token = trial_user["token"]
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("tier") == "free", f"expected auto-downgrade to free, got {d.get('tier')}"
        assert d.get("trial_expired") is True, "trial_expired should be True after expiry"
