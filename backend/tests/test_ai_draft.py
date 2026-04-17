"""
Test AI Draft Feature - POST /api/channels/{channel_id}/ai-draft
Tests:
1. Admin-only access (403 for non-admin users)
2. 404 for non-existent channel
3. Successful draft generation for admin users
4. Response structure validation (subject, body, business_email, channel_name)
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


class TestAIDraftFeature:
    """Test AI Draft endpoint for admin-only access and functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_auth_token(self, email: str, password: str) -> str:
        """Helper to get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def get_pipeline_channel_id(self, token: str) -> str:
        """Get a channel ID from the pipeline for testing"""
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/channels/by-outreach-status", headers=headers)
        if response.status_code == 200:
            channels = response.json().get("channels", [])
            if channels:
                return channels[0].get("channel_id")
        return None
    
    # ==================== AUTHENTICATION TESTS ====================
    
    def test_ai_draft_requires_authentication(self):
        """Test that AI draft endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/channels/test-channel-id/ai-draft")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ AI draft endpoint requires authentication")
    
    def test_ai_draft_forbidden_for_free_user(self):
        """Test that free tier users get 403 when trying to generate AI draft"""
        token = self.get_auth_token(FREE_USER_EMAIL, FREE_USER_PASSWORD)
        assert token is not None, "Failed to login as free user"
        
        headers = {"Authorization": f"Bearer {token}"}
        # Use any channel ID - should fail with 403 before checking channel existence
        response = self.session.post(
            f"{BASE_URL}/api/channels/any-channel-id/ai-draft",
            headers=headers
        )
        
        assert response.status_code == 403, f"Expected 403 for free user, got {response.status_code}"
        data = response.json()
        assert "admin" in data.get("detail", "").lower(), f"Expected admin-related error message, got: {data}"
        print("✓ Free tier users get 403 when trying to generate AI draft")
    
    # ==================== ADMIN ACCESS TESTS ====================
    
    def test_ai_draft_returns_404_for_nonexistent_channel(self):
        """Test that admin gets 404 for non-existent channel"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.post(
            f"{BASE_URL}/api/channels/nonexistent-channel-12345/ai-draft",
            headers=headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent channel, got {response.status_code}"
        print("✓ Admin gets 404 for non-existent channel")
    
    def test_ai_draft_success_for_admin(self):
        """Test that admin can successfully generate AI draft for a pipeline channel"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        # Get a channel from the pipeline
        channel_id = self.get_pipeline_channel_id(token)
        if not channel_id:
            pytest.skip("No channels in pipeline to test AI draft")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.post(
            f"{BASE_URL}/api/channels/{channel_id}/ai-draft",
            headers=headers,
            timeout=30  # AI generation may take time
        )
        
        # Should be 200 for successful generation
        assert response.status_code == 200, f"Expected 200 for admin AI draft, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert "subject" in data, "Response missing 'subject' field"
        assert "body" in data, "Response missing 'body' field"
        assert "business_email" in data, "Response missing 'business_email' field"
        assert "channel_name" in data, "Response missing 'channel_name' field"
        
        # Validate content is not empty
        assert isinstance(data["subject"], str), "Subject should be a string"
        assert isinstance(data["body"], str), "Body should be a string"
        assert len(data["body"]) > 0, "Body should not be empty"
        
        print(f"✓ Admin successfully generated AI draft for channel {channel_id}")
        print(f"  - Subject: {data['subject'][:50]}...")
        print(f"  - Body length: {len(data['body'])} chars")
        print(f"  - Business email: {data['business_email'] or 'N/A'}")
        print(f"  - Channel name: {data['channel_name']}")
    
    def test_ai_draft_response_structure(self):
        """Test that AI draft response has correct structure and types"""
        token = self.get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
        assert token is not None, "Failed to login as admin"
        
        channel_id = self.get_pipeline_channel_id(token)
        if not channel_id:
            pytest.skip("No channels in pipeline to test AI draft")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.post(
            f"{BASE_URL}/api/channels/{channel_id}/ai-draft",
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            pytest.skip(f"AI draft generation failed: {response.text}")
        
        data = response.json()
        
        # Check all required fields exist
        required_fields = ["subject", "body", "business_email", "channel_name"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Check types
        assert isinstance(data["subject"], str), "subject should be string"
        assert isinstance(data["body"], str), "body should be string"
        assert isinstance(data["business_email"], str), "business_email should be string"
        assert isinstance(data["channel_name"], str), "channel_name should be string"
        
        print("✓ AI draft response has correct structure and types")
    
    # ==================== EDGE CASES ====================
    
    def test_ai_draft_with_invalid_token(self):
        """Test AI draft with invalid/expired token"""
        headers = {"Authorization": "Bearer invalid-token-12345"}
        response = self.session.post(
            f"{BASE_URL}/api/channels/any-channel/ai-draft",
            headers=headers
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("✓ Invalid token returns 401")


class TestAIDraftUserRoleCheck:
    """Test that user role check works correctly for AI draft"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_admin_user_has_admin_role(self):
        """Verify admin user has role=admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"✓ Admin user has role=admin (tier: {data['user'].get('tier', 'N/A')})")
    
    def test_free_user_has_user_role(self):
        """Verify free user has role=user (not admin)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] != "admin", f"Free user should not have admin role"
        print(f"✓ Free user has role={data['user']['role']} (tier: {data['user'].get('tier', 'N/A')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
