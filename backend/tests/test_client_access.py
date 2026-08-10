"""
Backend tests for Client-facing read-only project view feature (iteration 32).

Covers:
  - Admin CRUD on /api/admin/assignments
  - Client role isolation (403 on admin endpoints, 403 for non-clients on client endpoints)
  - Loud guards: PATCH /channels/{id}/project-name, DELETE /channels/{id}/pipeline,
                 POST /pipeline/bulk-project (rename & clear) all return 400 on orphan risk
  - Client GET /client/assignments, /channels, CSV export gating (403 when disabled)
  - Assignment validation errors (missing project, duplicate, non-client target)
  - Expired assignment returns 410 on GET channels
"""
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or frontend_env.get("REACT_APP_BACKEND_URL")
).rstrip("/")

ADMIN_EMAIL = "adrian@affilitube.com"
ADMIN_PASSWORD = "admin123!"
CLIENT_EMAIL = "testclient@brand.com"
CLIENT_PASSWORD = "clientpass123"


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert "token" in body, f"Login response missing token: {body}"
    return body["token"], body.get("user", {})


@pytest.fixture(scope="module")
def admin_ctx(api):
    token, user = _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def client_ctx(api):
    token, user = _login(api, CLIENT_EMAIL, CLIENT_PASSWORD)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def existing_client_assignment(api, client_ctx):
    """The pre-seeded assignment for testclient@brand.com."""
    r = api.get(f"{BASE_URL}/api/client/assignments", headers=client_ctx["headers"])
    assert r.status_code == 200, r.text[:300]
    rows = r.json().get("assignments", [])
    assert rows, "Expected testclient@brand.com to have at least one assignment"
    return rows[0]


# ---------- Auth / role isolation ----------

class TestRoleIsolation:
    def test_client_login_returns_role_client(self, api):
        _, user = _login(api, CLIENT_EMAIL, CLIENT_PASSWORD)
        assert user.get("role") == "client", f"Client login role wrong: {user}"

    def test_client_cannot_hit_admin_assignments(self, api, client_ctx):
        r = api.get(f"{BASE_URL}/api/admin/assignments", headers=client_ctx["headers"])
        assert r.status_code == 403, f"Expected 403 for client on admin endpoint, got {r.status_code}: {r.text[:200]}"

    def test_client_cannot_hit_channels_endpoint(self, api, client_ctx):
        # Non-admin endpoint that requires get_current_user + _assert_not_client
        r = api.patch(
            f"{BASE_URL}/api/channels/nonexistent/project-name",
            json={"project_name": "x"},
            headers=client_ctx["headers"],
        )
        # Should be 403 (client blocked) not 404
        assert r.status_code == 403, f"Client should be blocked with 403, got {r.status_code}: {r.text[:200]}"

    def test_admin_cannot_hit_client_endpoint(self, api, admin_ctx):
        r = api.get(f"{BASE_URL}/api/client/assignments", headers=admin_ctx["headers"])
        assert r.status_code == 403

    def test_unauth_admin_assignments(self, api):
        r = api.get(f"{BASE_URL}/api/admin/assignments")
        assert r.status_code in (401, 403)


# ---------- Admin CRUD on assignments ----------

class TestAdminAssignmentCrud:
    @pytest.fixture(scope="class")
    def created_ids(self):
        return {"clients": [], "assignments": []}

    def test_list_assignments_ok(self, api, admin_ctx):
        r = api.get(f"{BASE_URL}/api/admin/assignments", headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert "assignments" in r.json()

    def test_create_client_user(self, api, admin_ctx, created_ids):
        email = f"TEST_client_{uuid.uuid4().hex[:8]}@example.com"
        r = api.post(f"{BASE_URL}/api/admin/users", json={
            "email": email, "password": "pass1234",
            "tier": "free", "role": "client",
        }, headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["role"] == "client"
        created_ids["clients"].append({"id": body["user_id"], "email": email})

    def test_assign_nonexistent_project_fails(self, api, admin_ctx, created_ids):
        cid = created_ids["clients"][0]["id"]
        r = api.post(f"{BASE_URL}/api/admin/assignments", json={
            "client_user_id": cid,
            "project_name": f"NoSuchProject_{uuid.uuid4().hex[:6]}",
        }, headers=admin_ctx["headers"])
        assert r.status_code == 400
        assert "does not exist" in r.json().get("detail", "").lower()

    def test_assign_to_non_client_fails(self, api, admin_ctx):
        # Try to assign to admin's own id
        r = api.post(f"{BASE_URL}/api/admin/assignments", json={
            "client_user_id": admin_ctx["user"]["id"],
            "project_name": "Refactor smoke project",
        }, headers=admin_ctx["headers"])
        assert r.status_code == 400
        assert "not a client" in r.json().get("detail", "").lower()

    def test_assign_valid_project(self, api, admin_ctx, created_ids, existing_client_assignment):
        # Use the same project the seeded assignment points to (guaranteed to exist for admin)
        proj = existing_client_assignment["project_name"]
        cid = created_ids["clients"][0]["id"]
        r = api.post(f"{BASE_URL}/api/admin/assignments", json={
            "client_user_id": cid,
            "project_name": proj,
            "export_enabled": True,
        }, headers=admin_ctx["headers"])
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body["client_user_id"] == cid
        assert body["project_name"] == proj
        assert body["export_enabled"] is True
        assert "id" in body
        created_ids["assignments"].append(body["id"])

    def test_assign_duplicate_fails(self, api, admin_ctx, created_ids, existing_client_assignment):
        proj = existing_client_assignment["project_name"]
        cid = created_ids["clients"][0]["id"]
        r = api.post(f"{BASE_URL}/api/admin/assignments", json={
            "client_user_id": cid, "project_name": proj,
        }, headers=admin_ctx["headers"])
        assert r.status_code == 400
        assert "already assigned" in r.json().get("detail", "").lower()

    def test_toggle_export_off(self, api, admin_ctx, created_ids):
        aid = created_ids["assignments"][0]
        r = api.patch(f"{BASE_URL}/api/admin/assignments/{aid}",
                      json={"export_enabled": False}, headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["export_enabled"] is False

    def test_set_expiry_in_past(self, api, admin_ctx, created_ids):
        aid = created_ids["assignments"][0]
        past = "2020-01-01T00:00:00+00:00"
        r = api.patch(f"{BASE_URL}/api/admin/assignments/{aid}",
                      json={"expires_at": past}, headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert r.json()["expires_at"] == past

    def test_expired_assignment_returns_410_for_client(self, api, admin_ctx, created_ids):
        """The temp client we just created has an expired assignment — GET channels must 410."""
        aid = created_ids["assignments"][0]
        client_info = created_ids["clients"][0]
        token, _ = _login(api, client_info["email"], "pass1234")
        r = api.get(f"{BASE_URL}/api/client/assignments/{aid}/channels",
                    headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 410, f"Expected 410 on expired, got {r.status_code}: {r.text[:200]}"

    def test_clear_expiry(self, api, admin_ctx, created_ids):
        aid = created_ids["assignments"][0]
        r = api.patch(f"{BASE_URL}/api/admin/assignments/{aid}",
                      json={"clear_expiry": True}, headers=admin_ctx["headers"])
        assert r.status_code == 200
        assert r.json().get("expires_at") in (None, "")

    def test_delete_assignment(self, api, admin_ctx, created_ids):
        aid = created_ids["assignments"][0]
        r = api.delete(f"{BASE_URL}/api/admin/assignments/{aid}",
                       headers=admin_ctx["headers"])
        assert r.status_code == 200
        # verify gone
        r2 = api.delete(f"{BASE_URL}/api/admin/assignments/{aid}",
                        headers=admin_ctx["headers"])
        assert r2.status_code == 404

    def test_other_admin_cannot_touch_assignment(self, api, admin_ctx, created_ids):
        # Update on non-existent assignment id
        r = api.patch(f"{BASE_URL}/api/admin/assignments/nonexistent-{uuid.uuid4().hex}",
                      json={"export_enabled": True}, headers=admin_ctx["headers"])
        assert r.status_code == 404

    @classmethod
    def teardown_class(cls):
        # best-effort cleanup of created client users
        try:
            s = requests.Session()
            r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
            if r.status_code == 200:
                token = r.json()["token"]
                headers = {"Authorization": f"Bearer {token}"}
                users = s.get(f"{BASE_URL}/api/admin/users", headers=headers).json()
                for u in users.get("users", []) if isinstance(users, dict) else users:
                    if isinstance(u, dict) and u.get("email", "").startswith("test_client_"):
                        s.delete(f"{BASE_URL}/api/admin/users/{u.get('id')}", headers=headers)
        except Exception:
            pass


# ---------- Loud guards ----------

class TestLoudGuards:
    @pytest.fixture(scope="class")
    def seeded(self, api):
        """Login admin, pull one channel from the assigned project."""
        token, user = _login(api, ADMIN_EMAIL, ADMIN_PASSWORD)
        headers = {"Authorization": f"Bearer {token}"}
        # get seeded client's assignment to learn the project name
        ct, _ = _login(api, CLIENT_EMAIL, CLIENT_PASSWORD)
        rows = requests.get(f"{BASE_URL}/api/client/assignments",
                            headers={"Authorization": f"Bearer {ct}"}).json()["assignments"]
        assert rows, "No pre-seeded assignment for testclient"
        proj = rows[0]["project_name"]

        # Get channels in that project via the client endpoint
        aid = rows[0]["id"]
        ch_resp = requests.get(f"{BASE_URL}/api/client/assignments/{aid}/channels",
                               headers={"Authorization": f"Bearer {ct}"})
        assert ch_resp.status_code == 200, ch_resp.text[:200]
        channels = ch_resp.json()["channels"]
        assert channels, f"Assigned project '{proj}' has no channels — seed data missing"
        return {"admin_headers": headers, "project_name": proj,
                "channel_id": channels[0]["channel_id"]}

    def test_rename_channel_out_of_assigned_project_400(self, seeded):
        r = requests.patch(
            f"{BASE_URL}/api/channels/{seeded['channel_id']}/project-name",
            json={"project_name": f"NEW_{uuid.uuid4().hex[:6]}"},
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 400, f"Expected 400 loud guard, got {r.status_code}: {r.text[:300]}"
        assert "cannot" in r.json().get("detail", "").lower()

    def test_clear_channel_project_400(self, seeded):
        r = requests.patch(
            f"{BASE_URL}/api/channels/{seeded['channel_id']}/project-name",
            json={"project_name": ""},
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 400, r.text[:300]

    def test_remove_channel_from_pipeline_400(self, seeded):
        r = requests.delete(
            f"{BASE_URL}/api/channels/{seeded['channel_id']}/pipeline",
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 400, r.text[:300]

    def test_bulk_rename_out_of_assigned_project_400(self, seeded):
        r = requests.post(
            f"{BASE_URL}/api/pipeline/bulk-project",
            json={"channel_ids": [seeded["channel_id"]],
                  "project_name": f"BULKNEW_{uuid.uuid4().hex[:6]}"},
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 400, r.text[:300]

    def test_bulk_clear_project_400(self, seeded):
        r = requests.post(
            f"{BASE_URL}/api/pipeline/bulk-project",
            json={"channel_ids": [seeded["channel_id"]], "project_name": ""},
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 400, r.text[:300]

    def test_rename_to_same_name_ok(self, seeded):
        """No-op rename should NOT be blocked."""
        r = requests.patch(
            f"{BASE_URL}/api/channels/{seeded['channel_id']}/project-name",
            json={"project_name": seeded["project_name"]},
            headers=seeded["admin_headers"],
        )
        assert r.status_code == 200, f"Same-name rename should pass, got {r.status_code}: {r.text[:200]}"


# ---------- Client read paths + CSV ----------

class TestClientRead:
    def test_client_list_assignments(self, api, client_ctx):
        r = api.get(f"{BASE_URL}/api/client/assignments", headers=client_ctx["headers"])
        assert r.status_code == 200
        rows = r.json()["assignments"]
        assert rows
        first = rows[0]
        for k in ("id", "project_name", "export_enabled", "expired", "channel_count"):
            assert k in first, f"Missing key {k} in assignment row: {first}"

    def test_client_get_assignment_channels(self, api, client_ctx, existing_client_assignment):
        aid = existing_client_assignment["id"]
        r = api.get(f"{BASE_URL}/api/client/assignments/{aid}/channels",
                    headers=client_ctx["headers"])
        assert r.status_code == 200
        body = r.json()
        assert "assignment" in body and "channels" in body
        # sanitisation check — no pipeline fields
        for ch in body["channels"]:
            for banned in ("notes", "contact_log", "outreach_status", "user_id"):
                assert banned not in ch, f"Sensitive field '{banned}' leaked in client channel view"

    def test_client_cannot_access_other_assignment(self, api, client_ctx):
        r = api.get(f"{BASE_URL}/api/client/assignments/does-not-exist/channels",
                    headers=client_ctx["headers"])
        assert r.status_code == 404

    def test_client_csv_export_when_enabled(self, api, client_ctx, existing_client_assignment):
        assert existing_client_assignment.get("export_enabled") is True, \
            "Seeded assignment expected export_enabled=true"
        aid = existing_client_assignment["id"]
        r = api.post(f"{BASE_URL}/api/client/assignments/{aid}/export/csv",
                     headers=client_ctx["headers"])
        assert r.status_code == 200, r.text[:300]
        assert "text/csv" in r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".csv" in cd
        # first line must be header with expected cols
        first_line = r.text.splitlines()[0]
        for col in ("channel_name", "subscriber_count", "video_count", "country_name"):
            assert col in first_line, f"CSV missing header {col}: {first_line}"

    def test_client_csv_export_403_when_disabled(self, api, admin_ctx, client_ctx, existing_client_assignment):
        """Toggle export off, verify client hits 403, toggle back on."""
        aid = existing_client_assignment["id"]
        # toggle off
        r = api.patch(f"{BASE_URL}/api/admin/assignments/{aid}",
                      json={"export_enabled": False}, headers=admin_ctx["headers"])
        assert r.status_code == 200
        try:
            r2 = api.post(f"{BASE_URL}/api/client/assignments/{aid}/export/csv",
                          headers=client_ctx["headers"])
            assert r2.status_code == 403, f"Expected 403 when export disabled, got {r2.status_code}"
        finally:
            # restore
            api.patch(f"{BASE_URL}/api/admin/assignments/{aid}",
                      json={"export_enabled": True}, headers=admin_ctx["headers"])
