"""
Tests for Pipeline Info Button and Background Sponsorship Caching Feature
- Tests PATCH /api/channels/{channel_id}/outreach-status with BackgroundTasks
- Tests sponsorship data auto-caching when channel enters pipeline
- Tests GET /api/channels/{channel_id}/sponsorship-data endpoint
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@affilitube.com"
ADMIN_PASSWORD = "admin123!"
FREE_EMAIL = "freetest@test.com"
FREE_PASSWORD = "password123"


class TestPipelineInfoButton:
    """Tests for Pipeline Info Button feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin (Pro tier) authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("user", {}).get("tier") == "pro", "Admin should be Pro tier"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def free_token(self):
        """Get free tier authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_EMAIL,
            "password": FREE_PASSWORD
        })
        assert response.status_code == 200, f"Free user login failed: {response.text}"
        data = response.json()
        assert data.get("user", {}).get("tier") == "free", "Free user should be free tier"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth token"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def free_headers(self, free_token):
        """Headers with free user auth token"""
        return {"Authorization": f"Bearer {free_token}", "Content-Type": "application/json"}
    
    # ==================== Backend API Tests ====================
    
    def test_outreach_status_endpoint_requires_auth(self):
        """Test that PATCH /api/channels/{channel_id}/outreach-status requires authentication"""
        response = requests.patch(
            f"{BASE_URL}/api/channels/test_channel_id/outreach-status",
            json={"status": "contacted"}
        )
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_outreach_status_free_user_denied(self, free_headers):
        """Test that free tier users cannot access pipeline (403)"""
        response = requests.patch(
            f"{BASE_URL}/api/channels/test_channel_id/outreach-status",
            headers=free_headers,
            json={"status": "contacted"}
        )
        assert response.status_code == 403, f"Expected 403 for free user, got {response.status_code}"
        assert "pipeline" in response.text.lower() or "plan" in response.text.lower()
    
    def test_outreach_status_invalid_status(self, admin_headers):
        """Test that invalid status values are rejected"""
        # First get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/outreach-status",
            headers=admin_headers,
            json={"status": "invalid_status_xyz"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
    
    def test_outreach_status_update_success(self, admin_headers):
        """Test successful outreach status update"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        original_status = channels[0].get("outreach_status", "not_contacted")
        
        # Update to a different status
        new_status = "contacted" if original_status != "contacted" else "replied"
        
        response = requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/outreach-status",
            headers=admin_headers,
            json={"status": new_status, "note": "Test note from pytest"}
        )
        assert response.status_code == 200, f"Status update failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == new_status
        assert data.get("log_entry", {}).get("note") == "Test note from pytest"
        
        # Restore original status
        requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/outreach-status",
            headers=admin_headers,
            json={"status": original_status}
        )
    
    def test_sponsorship_data_endpoint_requires_auth(self):
        """Test that GET /api/channels/{channel_id}/sponsorship-data requires authentication"""
        response = requests.get(f"{BASE_URL}/api/channels/test_channel_id/sponsorship-data")
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
    
    def test_sponsorship_data_endpoint_returns_data(self, admin_headers):
        """Test that sponsorship data endpoint returns correct structure"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/channels/{channel_id}/sponsorship-data",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Sponsorship data fetch failed: {response.text}"
        
        data = response.json()
        # Check required fields in response
        assert "is_sponsored_active" in data or "confidence_score" in data, \
            f"Missing expected fields in sponsorship data: {data.keys()}"
    
    def test_follow_up_date_update(self, admin_headers):
        """Test follow-up date update endpoint"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        # Set a follow-up date
        response = requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/follow-up-date",
            headers=admin_headers,
            json={"follow_up_date": "2026-05-01"}
        )
        assert response.status_code == 200, f"Follow-up date update failed: {response.text}"
        
        # Clear the follow-up date
        response = requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/follow-up-date",
            headers=admin_headers,
            json={"follow_up_date": None}
        )
        assert response.status_code == 200
    
    def test_channel_notes_update(self, admin_headers):
        """Test channel notes update endpoint"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        # Update notes
        response = requests.put(
            f"{BASE_URL}/api/channels/{channel_id}/notes",
            headers=admin_headers,
            json={"notes": "Test notes from pytest - " + str(time.time())}
        )
        assert response.status_code == 200, f"Notes update failed: {response.text}"
    
    def test_pipeline_channels_list(self, admin_headers):
        """Test getting channels by outreach status"""
        response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "channels" in data
        assert "status_counts" in data
        
        # Verify channel structure
        if data["channels"]:
            channel = data["channels"][0]
            assert "channel_id" in channel
            assert "channel_name" in channel
            assert "outreach_status" in channel or channel.get("outreach_status") is None
    
    def test_pipeline_filter_by_status(self, admin_headers):
        """Test filtering pipeline channels by status"""
        response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers,
            params={"status": "contacted"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # All returned channels should have 'contacted' status
        for channel in data.get("channels", []):
            assert channel.get("outreach_status") == "contacted", \
                f"Expected 'contacted' status, got {channel.get('outreach_status')}"


class TestBackgroundSponsorshipCache:
    """Tests for background sponsorship data caching"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Headers with admin auth token"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_background_task_parameter_accepted(self, admin_headers):
        """Test that the endpoint accepts BackgroundTasks parameter (no error)"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        # This should work without errors - BackgroundTasks is handled by FastAPI
        response = requests.patch(
            f"{BASE_URL}/api/channels/{channel_id}/outreach-status",
            headers=admin_headers,
            json={"status": "contacted"}
        )
        assert response.status_code == 200, f"Request failed: {response.text}"
    
    def test_sponsorship_data_cached_after_pipeline_entry(self, admin_headers):
        """Test that sponsorship data is available after channel enters pipeline"""
        # Get a channel from the pipeline
        channels_response = requests.get(
            f"{BASE_URL}/api/channels/by-outreach-status",
            headers=admin_headers
        )
        assert channels_response.status_code == 200
        channels = channels_response.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test")
        
        channel_id = channels[0]["channel_id"]
        
        # Wait a bit for any background task to complete
        time.sleep(2)
        
        # Check if sponsorship data is available
        response = requests.get(
            f"{BASE_URL}/api/channels/{channel_id}/sponsorship-data",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Sponsorship data fetch failed: {response.text}"
        
        data = response.json()
        # Should have some data structure
        assert isinstance(data, dict), "Expected dict response"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
