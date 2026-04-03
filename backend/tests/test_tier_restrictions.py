"""
Test tier restriction endpoints for free tier users.
Tests that /api/export/csv, /api/search-history, /api/search-reports return 403 with proper JSON format.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
FREE_USER_EMAIL = "freetest@test.com"
FREE_USER_PASSWORD = "password123"
PRO_USER_EMAIL = "admin@affilitube.com"
PRO_USER_PASSWORD = "admin123!"


class TestTierRestrictions:
    """Test tier restriction 403 responses for free tier users"""
    
    @pytest.fixture(scope="class")
    def free_user_token(self):
        """Get auth token for free tier user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Free user login failed: {response.text}")
        return response.json().get("token")
    
    @pytest.fixture(scope="class")
    def pro_user_token(self):
        """Get auth token for pro tier user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PRO_USER_EMAIL,
            "password": PRO_USER_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Pro user login failed: {response.text}")
        return response.json().get("token")
    
    def test_free_user_login_returns_free_tier(self, free_user_token):
        """Verify free user has tier=free"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tier") == "free", f"Expected tier=free, got {data.get('tier')}"
        print(f"✓ Free user tier verified: {data.get('tier')}")
    
    def test_pro_user_login_returns_pro_tier(self, pro_user_token):
        """Verify pro user has tier=pro"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {pro_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("tier") == "pro", f"Expected tier=pro, got {data.get('tier')}"
        print(f"✓ Pro user tier verified: {data.get('tier')}")
    
    # ==================== FREE USER 403 TESTS ====================
    
    def test_export_csv_returns_403_for_free_user(self, free_user_token):
        """POST /api/export/csv returns 403 JSON for free tier user"""
        response = requests.post(
            f"{BASE_URL}/api/export/csv",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json=["test_channel_id"]
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        data = response.json()
        assert data.get("error") == "upgrade_required", f"Expected error=upgrade_required, got {data.get('error')}"
        assert "Starter or Pro plan" in data.get("message", ""), f"Message should mention Starter or Pro plan"
        assert data.get("upgrade_url") == "/pricing", f"Expected upgrade_url=/pricing, got {data.get('upgrade_url')}"
        print(f"✓ /api/export/csv returns correct 403 JSON for free user")
    
    def test_search_history_post_returns_403_for_free_user(self, free_user_token):
        """POST /api/search-history returns 403 JSON for free tier user"""
        response = requests.post(
            f"{BASE_URL}/api/search-history",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={
                "name": "Test Search",
                "keywords": ["test"],
                "filters": {"min_subscribers": 1000}
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        data = response.json()
        assert data.get("error") == "upgrade_required", f"Expected error=upgrade_required, got {data.get('error')}"
        assert "Starter or Pro plan" in data.get("message", ""), f"Message should mention Starter or Pro plan"
        assert data.get("upgrade_url") == "/pricing", f"Expected upgrade_url=/pricing, got {data.get('upgrade_url')}"
        print(f"✓ POST /api/search-history returns correct 403 JSON for free user")
    
    def test_search_reports_post_returns_403_for_free_user(self, free_user_token):
        """POST /api/search-reports returns 403 JSON for free tier user"""
        response = requests.post(
            f"{BASE_URL}/api/search-reports",
            headers={"Authorization": f"Bearer {free_user_token}"},
            json={
                "name": "Test Report",
                "keywords": ["test"],
                "filters": {"min_subscribers": 1000},
                "channels": []
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        
        data = response.json()
        assert data.get("error") == "upgrade_required", f"Expected error=upgrade_required, got {data.get('error')}"
        assert "Starter or Pro plan" in data.get("message", ""), f"Message should mention Starter or Pro plan"
        assert data.get("upgrade_url") == "/pricing", f"Expected upgrade_url=/pricing, got {data.get('upgrade_url')}"
        print(f"✓ POST /api/search-reports returns correct 403 JSON for free user")
    
    # ==================== PRO USER ACCESS TESTS ====================
    
    def test_export_csv_accessible_for_pro_user(self, pro_user_token):
        """POST /api/export/csv does NOT return 403 for pro tier user"""
        response = requests.post(
            f"{BASE_URL}/api/export/csv",
            headers={"Authorization": f"Bearer {pro_user_token}"},
            json=["test_channel_id"]
        )
        # Should NOT be 403 - might be 404 (no channels found) or 200
        assert response.status_code != 403, f"Pro user should not get 403, got {response.status_code}"
        print(f"✓ /api/export/csv accessible for pro user (status: {response.status_code})")
    
    def test_search_history_post_accessible_for_pro_user(self, pro_user_token):
        """POST /api/search-history does NOT return 403 for pro tier user"""
        response = requests.post(
            f"{BASE_URL}/api/search-history",
            headers={"Authorization": f"Bearer {pro_user_token}"},
            json={
                "name": "TEST_Pro Search",
                "keywords": ["test"],
                "filters": {"min_subscribers": 1000}
            }
        )
        # Should NOT be 403 - should be 200 (success)
        assert response.status_code != 403, f"Pro user should not get 403, got {response.status_code}"
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ POST /api/search-history accessible for pro user (status: {response.status_code})")
    
    def test_search_reports_post_accessible_for_pro_user(self, pro_user_token):
        """POST /api/search-reports does NOT return 403 for pro tier user"""
        response = requests.post(
            f"{BASE_URL}/api/search-reports",
            headers={"Authorization": f"Bearer {pro_user_token}"},
            json={
                "name": "TEST_Pro Report",
                "keywords": ["test"],
                "filters": {"min_subscribers": 1000},
                "channels": []
            }
        )
        # Should NOT be 403 - should be 200 (success)
        assert response.status_code != 403, f"Pro user should not get 403, got {response.status_code}"
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ POST /api/search-reports accessible for pro user (status: {response.status_code})")
    
    # ==================== USER USAGE ENDPOINT ====================
    
    def test_user_usage_returns_correct_tier_info(self, free_user_token):
        """GET /api/user/usage returns correct tier info for free user"""
        response = requests.get(
            f"{BASE_URL}/api/user/usage",
            headers={"Authorization": f"Bearer {free_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("tier") == "free", f"Expected tier=free, got {data.get('tier')}"
        assert data.get("csv_export") == False, f"Free tier should have csv_export=False"
        assert data.get("saved_searches") == False, f"Free tier should have saved_searches=False"
        assert data.get("saved_reports") == False, f"Free tier should have saved_reports=False"
        print(f"✓ /api/user/usage returns correct tier restrictions for free user")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
