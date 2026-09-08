"""Backend tests for Google-Developer-Policy III.E.4.f metric attribution.

Verifies that all three CSV export endpoints prepend a '# Note:' comment row
BEFORE the CSV header row, clarifying which columns are AffiliTube-calculated
and not derived from the YouTube API.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trial-saas-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"
CLIENT_EMAIL = "testclient@brand.com"
CLIENT_PASSWORD = "clientpass123"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASSWORD)


@pytest.fixture(scope="module")
def admin_channel_ids(admin_token):
    """Return admin-owned, non-purged channel_ids by querying Mongo directly."""
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")

    async def _fetch():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = c[os.environ["DB_NAME"]]
        u = await db.users.find_one({"email": ADMIN_EMAIL})
        if not u:
            return []
        rows = await db.channels.find(
            {"user_id": u["id"], "retention_purged": {"$ne": True}},
            {"channel_id": 1},
        ).to_list(5)
        return [r["channel_id"] for r in rows if r.get("channel_id")]

    return asyncio.run(_fetch())


class TestCsvAttributionNote:
    """Verify each CSV export starts with '# Note:' before the CSV header row."""

    def test_user_export_csv_has_note_before_header(self, admin_token, admin_channel_ids):
        if not admin_channel_ids:
            pytest.skip("No admin-owned channels available to test /export/csv")
        r = requests.post(
            f"{API}/export/csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=admin_channel_ids,
            timeout=30,
        )
        assert r.status_code == 200, f"/export/csv status {r.status_code}: {r.text[:200]}"
        body = r.text
        lines = body.splitlines()
        assert len(lines) >= 2, "CSV must contain at least a note row + header"
        assert lines[0].startswith("# Note:"), f"First row must start with '# Note:', got: {lines[0][:120]}"
        assert "AffiliTube" in lines[0]
        assert "NOT derived from the YouTube API" in lines[0]
        # Header row (line 2) must contain the AffiliTube-calculated columns
        header = lines[1]
        assert "score_total" in header
        assert "affiliate_score" in header

    def test_pipeline_export_csv_has_note_before_header(self, admin_token, admin_channel_ids):
        if not admin_channel_ids:
            pytest.skip("No admin channels to test /pipeline/export/csv")
        r = requests.post(
            f"{API}/pipeline/export/csv",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=admin_channel_ids,
            timeout=30,
        )
        assert r.status_code == 200, f"/pipeline/export/csv status {r.status_code}: {r.text[:200]}"
        lines = r.text.splitlines()
        assert lines[0].startswith("# Note:")
        assert "AffiliTube" in lines[0]
        assert "score_total" in lines[1]
        assert "affiliate_score" in lines[1]

    def test_client_export_csv_has_note_before_header(self, client_token):
        # Fetch assignment
        r = requests.get(
            f"{API}/client/assignments",
            headers={"Authorization": f"Bearer {client_token}"},
            timeout=30,
        )
        assert r.status_code == 200, f"client/assignments status {r.status_code}: {r.text[:200]}"
        data = r.json()
        items = data if isinstance(data, list) else data.get("assignments") or data.get("items") or []
        if not items:
            pytest.skip("No client assignments to test client CSV export")
        assignment_id = items[0].get("id") or items[0].get("assignment_id")
        assert assignment_id, f"assignment payload missing id: {items[0]}"

        r2 = requests.post(
            f"{API}/client/assignments/{assignment_id}/export/csv",
            headers={"Authorization": f"Bearer {client_token}"},
            timeout=30,
        )
        assert r2.status_code == 200, f"client export status {r2.status_code}: {r2.text[:200]}"
        lines = r2.text.splitlines()
        assert lines[0].startswith("# Note:"), f"first line: {lines[0][:120]}"
        assert "AffiliTube" in lines[0]
        # header follows
        assert "score_total" in lines[1]


class TestAuthBasic:
    """Sanity: creds still work (regression)."""

    def test_admin_login(self):
        t = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert isinstance(t, str) and len(t) > 10

    def test_client_login(self):
        t = _login(CLIENT_EMAIL, CLIENT_PASSWORD)
        assert isinstance(t, str) and len(t) > 10
