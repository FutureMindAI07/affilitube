"""
Tier B backend regression tests.

Verifies:
  1. bcrypt verify/hash off-loop (register + login + /me + wrong-pw 401 + reset)
  2. googleapiclient .execute() wrapped in run_in_executor (channels/search,
     sponsorship-data)
  3. SaaS Radar /ingest and /enrich now 503 when a same-kind job is already
     running, and /cancel-stuck clears it.
  4. Verdict / outreach tracking PATCH endpoints untouched.
  5. /topic-counts + /products filter sanity.

Uses production-style preview backend URL from REACT_APP_BACKEND_URL.
"""

import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"

REQ_TIMEOUT = 30  # individual call ceiling; bcrypt should respond < 5s


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=REQ_TIMEOUT,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------- #
# 1. Auth — bcrypt off-loop fix
# --------------------------------------------------------------------------- #
class TestAuthBcryptOffLoop:
    def test_register_and_login_new_user_fast(self):
        email = f"test-tierB-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}@example.com"
        password = "TierBTest!234"

        # Register
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": password, "name": "Tier B Test"},
            timeout=REQ_TIMEOUT,
        )
        reg_elapsed = time.time() - t0
        assert r.status_code in (200, 201), f"register failed {r.status_code} {r.text}"
        assert reg_elapsed < 10, f"register took {reg_elapsed:.2f}s (>10s)"
        body = r.json()
        assert "token" in body or "access_token" in body, f"no token in reg response {body}"

        # Login same creds
        t0 = time.time()
        r2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=REQ_TIMEOUT,
        )
        login_elapsed = time.time() - t0
        assert r2.status_code == 200, f"login failed {r2.status_code} {r2.text}"
        assert login_elapsed < 5, f"login took {login_elapsed:.2f}s (>5s)"
        tok = r2.json().get("token") or r2.json().get("access_token")
        assert tok and len(tok) > 20

        # /me with token
        r3 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=REQ_TIMEOUT,
        )
        assert r3.status_code == 200
        me = r3.json()
        # Backend lowercases email on register, so compare case-insensitively
        assert (me.get("email") or "").lower() == email.lower()

    def test_admin_login_and_me(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200
        me = r.json()
        assert me.get("email") == ADMIN_EMAIL

    def test_admin_login_wrong_password_returns_401(self):
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "definitely-not-the-pw"},
            timeout=REQ_TIMEOUT,
        )
        elapsed = time.time() - t0
        assert r.status_code == 401, f"expected 401, got {r.status_code} {r.text}"
        assert elapsed < 5, f"wrong-pw login took {elapsed:.2f}s (>5s)"

    def test_request_password_reset_does_not_crash(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/request-password-reset",
            json={"email": ADMIN_EMAIL},
            timeout=REQ_TIMEOUT,
        )
        # Endpoint should always return success-ish (don't leak account existence)
        assert r.status_code in (200, 202), f"reset request returned {r.status_code} {r.text}"


# --------------------------------------------------------------------------- #
# 2. YouTube googleapiclient off-loop — channels/search + sponsorship-data
# --------------------------------------------------------------------------- #
class TestYouTubeOffLoop:
    def test_channels_search_returns_non_500(self, admin_headers):
        # The real endpoint is /api/search (review request said /api/channels/search
        # but that route does not exist; /api/search is the actual entry that
        # consumes 13 .execute() callsites now wrapped in _yt_execute).
        payload = {
            "keywords": ["productivity"],
            "search_mode": "channels_only",
            "max_results_per_keyword": 2,
        }
        t0 = time.time()
        r = requests.post(
            f"{BASE_URL}/api/search",
            headers=admin_headers,
            json=payload,
            timeout=60,
        )
        elapsed = time.time() - t0
        # 200 = success, 429 = quota, 400 = validation; not 500/timeout
        assert r.status_code in (200, 400, 403, 429), f"got {r.status_code} {r.text[:300]}"
        assert elapsed < 60, f"/api/search took {elapsed:.2f}s"

    def test_sponsorship_data_requires_auth(self):
        r = requests.get(
            f"{BASE_URL}/api/channels/UC_unknown_channel_id_xyz/sponsorship-data",
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code in (401, 403), f"expected auth-required, got {r.status_code}"

    def test_sponsorship_data_unknown_channel(self, admin_headers):
        t0 = time.time()
        r = requests.get(
            f"{BASE_URL}/api/channels/UC_unknown_channel_id_xyz/sponsorship-data",
            headers=admin_headers,
            timeout=60,
        )
        elapsed = time.time() - t0
        # Should be 4xx (not found / bad request) or 200 with empty; never 500.
        assert r.status_code != 500, f"500 on unknown channel: {r.text[:300]}"
        assert elapsed < 60


# --------------------------------------------------------------------------- #
# 3. SaaS Radar 503 short-circuit on /enrich and /ingest
# --------------------------------------------------------------------------- #
class TestSaaSRadar503Guard:
    def _cancel_stuck(self, admin_headers):
        try:
            requests.post(
                f"{BASE_URL}/api/admin/saas-radar/cancel-stuck",
                headers=admin_headers,
                timeout=REQ_TIMEOUT,
            )
        except Exception:
            pass

    def test_enrich_503_when_already_running(self, admin_headers):
        # Make sure no stale running jobs.
        self._cancel_stuck(admin_headers)
        body = {"limit": 1, "use_llm": False, "use_playwright": False}
        r1 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/enrich",
            headers=admin_headers,
            json=body,
            timeout=REQ_TIMEOUT,
        )
        assert r1.status_code == 200, f"first enrich failed {r1.status_code} {r1.text}"
        j1 = r1.json()
        assert j1.get("status") == "running"
        first_job_id = j1.get("job_id")
        assert first_job_id

        # Immediately try again — should 503.
        r2 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/enrich",
            headers=admin_headers,
            json=body,
            timeout=REQ_TIMEOUT,
        )
        try:
            assert r2.status_code == 503, f"expected 503, got {r2.status_code} {r2.text}"
            detail = r2.json().get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("running_job_id") == first_job_id, (
                    f"running_job_id mismatch: {detail} vs {first_job_id}"
                )
        finally:
            self._cancel_stuck(admin_headers)

    def test_ingest_503_when_already_running(self, admin_headers):
        self._cancel_stuck(admin_headers)
        body = {"days_back": 1, "topics": []}
        r1 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/ingest",
            headers=admin_headers,
            json=body,
            timeout=REQ_TIMEOUT,
        )
        assert r1.status_code == 200, f"first ingest failed {r1.status_code} {r1.text}"
        j1 = r1.json()
        assert j1.get("status") == "running"
        first_job_id = j1.get("job_id")
        assert first_job_id

        r2 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/ingest",
            headers=admin_headers,
            json=body,
            timeout=REQ_TIMEOUT,
        )
        try:
            assert r2.status_code == 503, f"expected 503, got {r2.status_code} {r2.text}"
            detail = r2.json().get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("running_job_id") == first_job_id, (
                    f"running_job_id mismatch: {detail} vs {first_job_id}"
                )
        finally:
            self._cancel_stuck(admin_headers)


# --------------------------------------------------------------------------- #
# 4. Verdict / outreach tracking — regression
# --------------------------------------------------------------------------- #
class TestOutreachTracking:
    @pytest.fixture(scope="class")
    def sample_ph_id(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/products?limit=5",
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"products list failed {r.status_code} {r.text[:200]}"
        body = r.json()
        items = body.get("products") or body.get("items") or body.get("results") or []
        if not items:
            pytest.skip("No SaaS Radar products in preview DB")
        return items[0].get("ph_id") or items[0].get("id")

    def test_set_outreach_status(self, admin_headers, sample_ph_id):
        r = requests.patch(
            f"{BASE_URL}/api/admin/saas-radar/products/{sample_ph_id}/outreach-status",
            headers=admin_headers,
            json={"status": "not_contacted"},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("success") is True

    def test_set_follow_up_date(self, admin_headers, sample_ph_id):
        iso = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        r = requests.patch(
            f"{BASE_URL}/api/admin/saas-radar/products/{sample_ph_id}/follow-up-date",
            headers=admin_headers,
            json={"follow_up_date": iso},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("success") is True

    def test_set_notes_and_persist(self, admin_headers, sample_ph_id):
        note_txt = f"TEST_note_{int(time.time())}"
        r = requests.patch(
            f"{BASE_URL}/api/admin/saas-radar/products/{sample_ph_id}/notes",
            headers=admin_headers,
            json={"outreach_notes": note_txt},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("success") is True

        # Verify persistence via product list filter
        r2 = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/products?limit=200",
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        assert r2.status_code == 200
        items = r2.json().get("products") or r2.json().get("items") or r2.json().get("results") or []
        match = next((p for p in items if (p.get("ph_id") == sample_ph_id or p.get("id") == sample_ph_id)), None)
        if match is not None:
            assert match.get("outreach_notes") == note_txt, (
                f"notes did not persist; got {match.get('outreach_notes')!r}"
            )


# --------------------------------------------------------------------------- #
# 5. topic-counts + filters sanity (Tier A regression)
# --------------------------------------------------------------------------- #
class TestTopicCountsAndFilters:
    def test_topic_counts(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/topic-counts?limit=5",
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        topics = body.get("topics") or body.get("items") or []
        assert isinstance(topics, list)

    def test_products_filter_combo(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/products",
            params={
                "bucket": "yellow",
                "hide_platform_apps": "true",
                "exclude": "shopify",
                "topics": "productivity",
                "limit": 2,
            },
            headers=admin_headers,
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        # Tolerant of either products/items/results key
        assert any(k in body for k in ("products", "items", "results", "total"))
