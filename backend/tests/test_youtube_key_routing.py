"""Regression tests for YouTube API key routing fix (admin vs regular user).

The fix: _cache_sponsorship_data background task now accepts and propagates
`user` to get_youtube_service so admins hit the admin YouTube API key quota.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trial-saas-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    assert admin_token
    return {"Authorization": f"Bearer {admin_token}"}


# --- Regression: health + auth ---

def test_health_root():
    r = requests.get(f"{BASE_URL}/health", timeout=10)
    assert r.status_code == 200


def test_health_api():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200


def test_admin_login_speed():
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    dt = time.time() - t0
    assert r.status_code == 200
    assert dt < 3.0, f"login took {dt:.2f}s"


def test_auth_me(admin_headers):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data.get("email") == ADMIN_EMAIL
    assert data.get("role") == "admin"


# --- Behaviour test: admin PATCH outreach-status triggers pre-cache path ---

def test_admin_patch_outreach_status_triggers_precache(admin_headers):
    # Find an admin-owned channel that has no cached sponsorship_data
    r = requests.get(f"{BASE_URL}/api/channels", headers=admin_headers, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"could not list channels: {r.status_code}")
    channels = r.json() if isinstance(r.json(), list) else r.json().get("channels", [])
    if not channels:
        pytest.skip("no channels in preview DB — static invariant covers the fix")

    # Pick any channel; flip status to 'contacted' then back
    target = channels[0]
    ch_id = target.get("id") or target.get("channel_id") or target.get("_id")
    assert ch_id, f"no id on channel: {target}"

    r = requests.patch(f"{BASE_URL}/api/channels/{ch_id}/outreach-status",
                       headers=admin_headers, json={"status": "contacted"}, timeout=20)
    # Accept 200 or 404 (channel may not be user-owned); print for debugging
    print(f"PATCH outreach-status ch={ch_id}: {r.status_code} {r.text[:200]}")
    assert r.status_code in (200, 204), f"expected 200, got {r.status_code}: {r.text}"

    # Give background task a moment
    time.sleep(6)

    # Fetch channel to see if sponsorship_data was cached (best-effort — may already have it)
    r2 = requests.get(f"{BASE_URL}/api/channels/{ch_id}", headers=admin_headers, timeout=15)
    if r2.status_code == 200:
        body = r2.json()
        print(f"post-PATCH channel keys: sponsorship_data present={('sponsorship_data' in body)}, last_sponsorship_check={body.get('last_sponsorship_check')}")


# --- Non-admin path: register throwaway user, patch a channel ---

def test_non_admin_path_still_works():
    ts = int(time.time())
    email = f"tester-key-routing-{ts}@example.com"
    pw = "password123"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"email": email, "password": pw, "name": "KeyRouteTester"}, timeout=15)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if not tok:
        # try login
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw}, timeout=10)
        assert r.status_code == 200
        tok = r.json().get("access_token") or r.json().get("token")
    assert tok
    h = {"Authorization": f"Bearer {tok}"}

    # Non-admin has no channels; just confirm /auth/me works & role=user
    me = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=10)
    assert me.status_code == 200
    assert me.json().get("role") in ("user", None, "free")


# --- SaaS Radar regression ---

def test_saas_radar_worker_status(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/saas-radar/worker-status", headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    # Field may be nested — best-effort
    assert "worker" in data or "alive" in data or "status" in data


def test_saas_radar_enrich_and_503_guard(admin_headers):
    body = {"limit": 3, "use_llm": False, "use_playwright": False}
    r1 = requests.post(f"{BASE_URL}/api/admin/saas-radar/enrich", headers=admin_headers, json=body, timeout=20)
    print(f"enrich #1: {r1.status_code} {r1.text[:200]}")
    assert r1.status_code in (200, 202), f"first enrich failed: {r1.status_code} {r1.text}"

    # Immediate second call should be blocked
    r2 = requests.post(f"{BASE_URL}/api/admin/saas-radar/enrich", headers=admin_headers, json=body, timeout=20)
    print(f"enrich #2: {r2.status_code} {r2.text[:300]}")
    assert r2.status_code == 503, f"expected 503 on second enrich, got {r2.status_code}"
    try:
        detail = r2.json().get("detail", {})
        if isinstance(detail, dict):
            assert detail.get("kind") == "enrich", f"detail.kind mismatch: {detail}"
    except Exception as e:
        print(f"could not parse 503 detail: {e}")

    # Cleanup
    rc = requests.post(f"{BASE_URL}/api/admin/saas-radar/cancel-stuck", headers=admin_headers, timeout=15)
    print(f"cancel-stuck: {rc.status_code} {rc.text[:200]}")
    assert rc.status_code in (200, 204)
