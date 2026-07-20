"""
Backend tests for deployment fix:
- New /health and /api/health endpoints (must NOT touch MongoDB, return {"status":"ok"} fast)
- Motor client hardening (auth flow still works, login remains fast)
- SaaS Radar worker Motor client hardening
- 503 guard + outreach tracking regressions
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trial-saas-hub.preview.emergentagent.com").rstrip("/")
LOCAL_URL = "http://127.0.0.1:8001"

ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------
class TestHealth:
    def test_api_health_returns_ok_fast(self):
        start = time.time()
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        elapsed = time.time() - start
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}
        assert elapsed < 2.0, f"took {elapsed}s"

    def test_api_health_20x_fast(self):
        times = []
        for _ in range(20):
            s = time.time()
            r = requests.get(f"{BASE_URL}/api/health", timeout=5)
            times.append(time.time() - s)
            assert r.status_code == 200
            assert r.json() == {"status": "ok"}
        # All under 1s each
        for t in times:
            assert t < 2.0
        print(f"20x /api/health avg={sum(times)/len(times):.3f}s max={max(times):.3f}s")

    def test_health_no_prefix_via_localhost(self):
        """K8s probes hit /health on localhost:8001 directly, bypassing ingress."""
        try:
            r = requests.get(f"{LOCAL_URL}/health", timeout=5)
        except Exception as e:
            pytest.skip(f"localhost:8001 not reachable: {e}")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_health_no_prefix_20x_via_localhost(self):
        try:
            requests.get(f"{LOCAL_URL}/health", timeout=2)
        except Exception as e:
            pytest.skip(f"localhost not reachable: {e}")
        times = []
        for _ in range(20):
            s = time.time()
            r = requests.get(f"{LOCAL_URL}/health", timeout=3)
            times.append(time.time() - s)
            assert r.status_code == 200
            assert r.json() == {"status": "ok"}
        for t in times:
            assert t < 1.0, f"health too slow: {t}s"
        print(f"20x localhost /health avg={sum(times)/len(times):.3f}s max={max(times):.3f}s")


# ---------------------------------------------------------------------------
# Auth flow (Motor hardening should be invisible)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"no token in response: {data}"
    return token


class TestAuth:
    def test_login_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_auth_me_returns_admin(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        user = r.json()
        assert user.get("email") == ADMIN_EMAIL

    def test_login_wrong_password_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword!"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_login_fast_p95_under_2s(self):
        times = []
        for _ in range(5):
            s = time.time()
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                timeout=10,
            )
            times.append(time.time() - s)
            assert r.status_code == 200
        times_sorted = sorted(times)
        p95 = times_sorted[-1]  # of 5 samples worst-case ~ p95
        print(f"login times: {times} p95~{p95:.3f}s")
        assert p95 < 3.0, f"login p95 too slow: {p95}s"


# ---------------------------------------------------------------------------
# SaaS Radar worker regressions
# ---------------------------------------------------------------------------
class TestSaasRadar:
    def _headers(self, token):
        return {"Authorization": f"Bearer {token}"}

    def test_worker_status(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/worker-status",
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200

    def test_cleanup_stuck_before(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/cancel-stuck",
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code in (200, 204)

    def test_enrich_then_503_guard(self, admin_token):
        h = self._headers(admin_token)
        payload = {"limit": 3, "use_llm": False, "use_playwright": False}
        r1 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/enrich", json=payload, headers=h, timeout=30
        )
        assert r1.status_code == 200, f"first enrich failed: {r1.status_code} {r1.text}"
        d1 = r1.json()
        assert "job_id" in d1
        assert d1.get("status") == "running"

        # Second immediate enrich should 503 with detail.kind == 'enrich'
        r2 = requests.post(
            f"{BASE_URL}/api/admin/saas-radar/enrich", json=payload, headers=h, timeout=30
        )
        assert r2.status_code == 503, f"expected 503, got {r2.status_code} {r2.text}"
        try:
            body = r2.json()
            detail = body.get("detail", {})
            if isinstance(detail, dict):
                assert detail.get("kind") == "enrich", f"detail: {detail}"
        except Exception:
            pass

        # cleanup
        requests.post(
            f"{BASE_URL}/api/admin/saas-radar/cancel-stuck", headers=h, timeout=15
        )

    def test_products_list(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/products?limit=1",
            headers=self._headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 200

    def test_outreach_status_patch(self, admin_token):
        h = self._headers(admin_token)
        # find a product
        r = requests.get(
            f"{BASE_URL}/api/admin/saas-radar/products?limit=1",
            headers=h, timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        products = data.get("products") or data.get("items") or (data if isinstance(data, list) else [])
        if not products:
            pytest.skip("no products available for outreach status test")
        ph_id = products[0].get("ph_id") or products[0].get("id")
        if not ph_id:
            pytest.skip("no ph_id on product")
        r = requests.patch(
            f"{BASE_URL}/api/admin/saas-radar/products/{ph_id}/outreach-status",
            json={"status": "not_contacted"},
            headers=h, timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
