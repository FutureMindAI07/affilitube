"""Tests for niche-aware Super Search prompt routing + 503-guard regression."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trial-saas-hub.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=90,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:300]}"
    token = r.json().get("access_token") or r.json().get("token")
    assert token, f"No token returned: {r.json()}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _enrich_payload(niche, channel_ids=None):
    return {
        "channel_ids": channel_ids or [],
        "channel_metadata": {},
        "niche": niche,
        "min_subscribers": 2000,
        "max_subscribers": 200000,
        "videos_to_scan": 5,
        "uploaded_within_days": 60,
        "super_search": True,
        "strict_mode": False,
    }


def _search_for_channel_ids(headers, niche, keyword):
    payload = {
        "keywords": [keyword],
        "niche": niche,
        "min_subscribers": 2000,
        "max_subscribers": 200000,
        "max_results_per_keyword": 5,
        "uploaded_within_days": 60,
    }
    r = requests.post(f"{BASE_URL}/api/search", headers=headers, json=payload, timeout=120)
    if r.status_code != 200:
        return []
    return [c.get("channel_id") for c in r.json().get("channels", []) if c.get("channel_id")]


# === Item: SaaS niche routing — enrich endpoint runs super_search pipeline w/ SaaS prompt ===
def test_search_saas_niche_super_search(admin_headers):
    ids = _search_for_channel_ids(admin_headers, "saas_software", "best crm software")
    r = requests.post(
        f"{BASE_URL}/api/channels/enrich",
        headers=admin_headers,
        json=_enrich_payload("saas_software", ids[:5]),
        timeout=240,
    )
    assert r.status_code == 200, f"SaaS enrich failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    # If channels exist, super_search meta must show requested==True
    if data.get("total", 0) > 0:
        meta = data.get("super_search") or {}
        assert meta.get("requested") is True, f"super_search.requested != true: {meta}"


# === Item: tech_gadgets routing — physical prompt path ===
def test_search_tech_gadgets_super_search(admin_headers):
    ids = _search_for_channel_ids(admin_headers, "tech_gadgets", "best mechanical keyboard")
    r = requests.post(
        f"{BASE_URL}/api/channels/enrich",
        headers=admin_headers,
        json=_enrich_payload("tech_gadgets", ids[:5]),
        timeout=240,
    )
    assert r.status_code == 200, f"tech_gadgets enrich failed: {r.status_code} {r.text[:500]}"
    data = r.json()
    if data.get("total", 0) > 0:
        meta = data.get("super_search") or {}
        assert meta.get("requested") is True, f"super_search.requested != true: {meta}"


# === Regression: 503-guard on saas-radar/enrich ===
def test_saas_radar_enrich_503_guard(admin_headers):
    body = {"limit": 3, "use_llm": False, "use_playwright": False}
    r1 = requests.post(
        f"{BASE_URL}/api/admin/saas-radar/enrich",
        headers=admin_headers,
        json=body,
        timeout=30,
    )
    # First call should accept (200/202)
    assert r1.status_code in (200, 202), f"first enrich call unexpected status: {r1.status_code} {r1.text[:300]}"
    # Immediately fire second — must 503 with kind=='enrich'
    r2 = requests.post(
        f"{BASE_URL}/api/admin/saas-radar/enrich",
        headers=admin_headers,
        json=body,
        timeout=15,
    )
    assert r2.status_code == 503, f"second enrich call expected 503 got {r2.status_code}: {r2.text[:300]}"
    try:
        det = r2.json().get("detail") or {}
        assert det.get("kind") == "enrich", f"detail.kind != 'enrich': {det}"
    except Exception as e:
        pytest.fail(f"503 body not JSON or missing kind: {r2.text[:300]} ({e})")


# === Regression: worker-status diagnostic ===
def test_saas_radar_worker_status(admin_headers):
    r = requests.get(
        f"{BASE_URL}/api/admin/saas-radar/worker-status",
        headers=admin_headers,
        timeout=15,
    )
    assert r.status_code == 200, f"worker-status status: {r.status_code} {r.text[:300]}"
    data = r.json()
    worker = data.get("worker") or {}
    assert worker.get("alive") is True, f"worker.alive != true: {worker}"


# === Cleanup: cancel any stuck enrich job left behind by the 503-guard test ===
def test_cancel_stuck_enrich(admin_headers):
    # Best-effort cleanup so subsequent runs are clean
    requests.post(
        f"{BASE_URL}/api/admin/saas-radar/cancel-stuck",
        headers=admin_headers,
        timeout=15,
    )
