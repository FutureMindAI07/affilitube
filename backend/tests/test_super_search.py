"""
Test Super Search Feature - Iteration 17
Tests:
1. EnrichRequest accepts super_search and competitor_brands fields
2. super_search=true returns 403 for non-admin users
3. GET /api/admin/competitor-brands works for admin
4. PUT /api/admin/competitor-brands saves brands for admin
5. GET /api/admin/competitor-brands returns 403 for non-admin
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@affilitube.com"
ADMIN_PASSWORD = "admin123!"
FREE_USER_EMAIL = "freetest@test.com"
FREE_USER_PASSWORD = "password123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def free_user_token():
    """Get free user authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": FREE_USER_EMAIL,
        "password": FREE_USER_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Free user login failed: {response.status_code} - {response.text}")


class TestSuperSearchBackend:
    """Backend tests for Super Search feature"""

    def test_admin_login_returns_admin_role(self, admin_token):
        """Verify admin user has admin role"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") == "admin", f"Expected admin role, got {data.get('role')}"
        print(f"✓ Admin user has role: {data.get('role')}")

    def test_free_user_login_returns_user_role(self, free_user_token):
        """Verify free user has user role (not admin)"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("role") != "admin", f"Free user should not have admin role"
        print(f"✓ Free user has role: {data.get('role')}")


class TestCompetitorBrandsEndpoints:
    """Tests for competitor brands CRUD endpoints"""

    def test_get_competitor_brands_admin_success(self, admin_token):
        """GET /api/admin/competitor-brands works for admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/competitor-brands",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "competitor_brands" in data, "Response should contain competitor_brands field"
        assert isinstance(data["competitor_brands"], list), "competitor_brands should be a list"
        print(f"✓ GET competitor-brands for admin: {data}")

    def test_put_competitor_brands_admin_success(self, admin_token):
        """PUT /api/admin/competitor-brands saves brands for admin"""
        test_brands = ["TestBrand1", "TestBrand2", "NordVPN"]
        response = requests.put(
            f"{BASE_URL}/api/admin/competitor-brands",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"competitor_brands": test_brands}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should have success: true"
        assert "competitor_brands" in data, "Response should contain competitor_brands"
        print(f"✓ PUT competitor-brands for admin: {data}")

        # Verify the brands were saved by fetching them again
        get_response = requests.get(
            f"{BASE_URL}/api/admin/competitor-brands",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        saved_brands = get_data.get("competitor_brands", [])
        for brand in test_brands:
            assert brand in saved_brands, f"Brand '{brand}' should be saved"
        print(f"✓ Verified saved brands: {saved_brands}")

    def test_get_competitor_brands_free_user_forbidden(self, free_user_token):
        """GET /api/admin/competitor-brands returns 403 for non-admin"""
        response = requests.get(
            f"{BASE_URL}/api/admin/competitor-brands",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ GET competitor-brands for free user returns 403")

    def test_put_competitor_brands_free_user_forbidden(self, free_user_token):
        """PUT /api/admin/competitor-brands returns 403 for non-admin"""
        response = requests.put(
            f"{BASE_URL}/api/admin/competitor-brands",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={"competitor_brands": ["SomeBrand"]}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"✓ PUT competitor-brands for free user returns 403")


class TestSuperSearchEnrichment:
    """Tests for super_search parameter in enrichment endpoint"""

    def test_enrich_with_super_search_free_user_forbidden(self, free_user_token):
        """POST /api/channels/enrich with super_search=true returns 403 for non-admin"""
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={
                "channel_ids": ["UC_test_channel"],
                "channel_metadata": {},
                "niche": "saas_software",
                "super_search": True,
                "competitor_brands": []
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "admin" in data.get("detail", "").lower() or "super" in data.get("detail", "").lower(), \
            f"Error message should mention admin or super search: {data}"
        print(f"✓ Enrich with super_search=true for free user returns 403: {data.get('detail')}")

    def test_enrich_without_super_search_free_user_allowed(self, free_user_token):
        """POST /api/channels/enrich with super_search=false works for free user (may fail for other reasons)"""
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={
                "channel_ids": [],  # Empty to avoid actual API calls
                "channel_metadata": {},
                "niche": "saas_software",
                "super_search": False,
                "competitor_brands": []
            }
        )
        # Should NOT be 403 - may be 200 with empty results or other error
        assert response.status_code != 403, f"Should not be 403 when super_search=false: {response.text}"
        print(f"✓ Enrich with super_search=false for free user: status {response.status_code}")

    def test_enrich_request_accepts_super_search_fields(self, admin_token):
        """Verify EnrichRequest model accepts super_search and competitor_brands fields"""
        # Test that the endpoint accepts these fields without validation error
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "channel_ids": [],  # Empty to avoid actual API calls
                "channel_metadata": {},
                "niche": "saas_software",
                "min_subscribers": 2000,
                "max_subscribers": 100000,
                "videos_to_scan": 5,
                "scan_video_descriptions": False,
                "max_channels_to_enrich": None,
                "affiliate_platforms": [],
                "uploaded_within_days": 90,
                "hide_pipeline_channels": False,
                "super_search": True,
                "competitor_brands": ["NordVPN", "Surfshark"]
            }
        )
        # Should not be 422 (validation error) - the fields should be accepted
        assert response.status_code != 422, f"EnrichRequest should accept super_search and competitor_brands: {response.text}"
        print(f"✓ EnrichRequest accepts super_search and competitor_brands fields: status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
