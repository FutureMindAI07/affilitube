"""
Test Outreach Pipeline Backend APIs
Tests for:
- PATCH /api/channels/{channel_id}/outreach-status
- PATCH /api/channels/{channel_id}/follow-up-date
- GET /api/channels/follow-ups/due
- GET /api/channels/by-outreach-status
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tier-restrictions.preview.emergentagent.com')

class TestOutreachPipelineAPIs:
    """Test outreach pipeline endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@affilitube.com",
            "password": "admin123!"
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            self.user_id = login_response.json().get("user", {}).get("id")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_get_outreach_statuses(self):
        """Test GET /api/channels/outreach-statuses returns valid statuses"""
        response = self.session.get(f"{BASE_URL}/api/channels/outreach-statuses")
        assert response.status_code == 200
        
        data = response.json()
        assert "statuses" in data
        expected_statuses = ["not_contacted", "contacted", "replied", "in_negotiation", "agreed", "declined", "no_response"]
        assert data["statuses"] == expected_statuses
        print(f"SUCCESS: Got {len(data['statuses'])} outreach statuses")
    
    def test_get_channels_by_outreach_status_empty(self):
        """Test GET /api/channels/by-outreach-status when no channels in pipeline"""
        response = self.session.get(f"{BASE_URL}/api/channels/by-outreach-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "channels" in data
        assert "total" in data
        assert "status_counts" in data
        print(f"SUCCESS: Got {data['total']} channels in pipeline")
    
    def test_get_channels_by_outreach_status_with_filter(self):
        """Test GET /api/channels/by-outreach-status with status filter"""
        response = self.session.get(f"{BASE_URL}/api/channels/by-outreach-status?status=contacted")
        assert response.status_code == 200
        
        data = response.json()
        assert "channels" in data
        print(f"SUCCESS: Got {data['total']} channels with 'contacted' status")
    
    def test_get_channels_by_outreach_status_invalid_filter(self):
        """Test GET /api/channels/by-outreach-status with invalid status filter"""
        response = self.session.get(f"{BASE_URL}/api/channels/by-outreach-status?status=invalid_status")
        assert response.status_code == 400
        print("SUCCESS: Invalid status filter returns 400")
    
    def test_get_follow_ups_due(self):
        """Test GET /api/channels/follow-ups/due"""
        response = self.session.get(f"{BASE_URL}/api/channels/follow-ups/due")
        assert response.status_code == 200
        
        data = response.json()
        assert "channels" in data
        assert "count" in data
        print(f"SUCCESS: Got {data['count']} due follow-ups")
    
    def test_update_outreach_status_channel_not_found(self):
        """Test PATCH /api/channels/{channel_id}/outreach-status with non-existent channel"""
        fake_channel_id = "UC_FAKE_CHANNEL_ID_12345"
        response = self.session.patch(
            f"{BASE_URL}/api/channels/{fake_channel_id}/outreach-status",
            json={"status": "contacted", "note": "Test note"}
        )
        assert response.status_code == 404
        print("SUCCESS: Non-existent channel returns 404")
    
    def test_update_outreach_status_invalid_status(self):
        """Test PATCH /api/channels/{channel_id}/outreach-status with invalid status"""
        fake_channel_id = "UC_FAKE_CHANNEL_ID_12345"
        response = self.session.patch(
            f"{BASE_URL}/api/channels/{fake_channel_id}/outreach-status",
            json={"status": "invalid_status", "note": "Test note"}
        )
        assert response.status_code == 400
        assert "Invalid status" in response.json().get("detail", "")
        print("SUCCESS: Invalid status returns 400")
    
    def test_update_follow_up_date_channel_not_found(self):
        """Test PATCH /api/channels/{channel_id}/follow-up-date with non-existent channel"""
        fake_channel_id = "UC_FAKE_CHANNEL_ID_12345"
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = self.session.patch(
            f"{BASE_URL}/api/channels/{fake_channel_id}/follow-up-date",
            json={"follow_up_date": tomorrow}
        )
        assert response.status_code == 404
        print("SUCCESS: Non-existent channel returns 404 for follow-up date update")


class TestOutreachWithTestChannel:
    """Test outreach endpoints with a test channel - requires creating a channel first"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and create test channel"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@affilitube.com",
            "password": "admin123!"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user_id = login_response.json().get("user", {}).get("id")
        
        # Create a test channel directly in the database via API
        # We'll use the shortlist endpoint to create a channel reference
        self.test_channel_id = f"UC_TEST_{uuid.uuid4().hex[:12]}"
    
    def test_outreach_workflow_requires_channel(self):
        """Verify that outreach status update requires an existing channel"""
        # Try to update status for a channel that doesn't exist
        response = self.session.patch(
            f"{BASE_URL}/api/channels/{self.test_channel_id}/outreach-status",
            json={"status": "contacted", "note": "Initial contact via email"}
        )
        
        # Should return 404 since channel doesn't exist
        assert response.status_code == 404
        print("SUCCESS: Outreach status update correctly requires existing channel")


class TestOutreachStatusValidation:
    """Test outreach status validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@affilitube.com",
            "password": "admin123!"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.status_code}")
        
        self.token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_all_valid_statuses_accepted(self):
        """Test that all valid statuses are accepted (validation only, not actual update)"""
        valid_statuses = ["not_contacted", "contacted", "replied", "in_negotiation", "agreed", "declined", "no_response"]
        fake_channel_id = "UC_FAKE_CHANNEL_12345"
        
        for status in valid_statuses:
            response = self.session.patch(
                f"{BASE_URL}/api/channels/{fake_channel_id}/outreach-status",
                json={"status": status}
            )
            # Should return 404 (channel not found) not 400 (invalid status)
            assert response.status_code == 404, f"Status '{status}' should be valid but got {response.status_code}"
        
        print(f"SUCCESS: All {len(valid_statuses)} valid statuses pass validation")
    
    def test_invalid_statuses_rejected(self):
        """Test that invalid statuses are rejected"""
        invalid_statuses = ["pending", "active", "closed", "unknown", ""]
        fake_channel_id = "UC_FAKE_CHANNEL_12345"
        
        for status in invalid_statuses:
            response = self.session.patch(
                f"{BASE_URL}/api/channels/{fake_channel_id}/outreach-status",
                json={"status": status}
            )
            assert response.status_code == 400, f"Status '{status}' should be invalid but got {response.status_code}"
        
        print(f"SUCCESS: All {len(invalid_statuses)} invalid statuses are rejected")


class TestAuthenticationRequired:
    """Test that outreach endpoints require authentication"""
    
    def test_outreach_status_requires_auth(self):
        """Test PATCH /api/channels/{channel_id}/outreach-status requires auth"""
        response = requests.patch(
            f"{BASE_URL}/api/channels/UC_TEST/outreach-status",
            json={"status": "contacted"}
        )
        assert response.status_code in [401, 403]
        print("SUCCESS: Outreach status update requires authentication")
    
    def test_follow_up_date_requires_auth(self):
        """Test PATCH /api/channels/{channel_id}/follow-up-date requires auth"""
        response = requests.patch(
            f"{BASE_URL}/api/channels/UC_TEST/follow-up-date",
            json={"follow_up_date": "2026-01-15"}
        )
        assert response.status_code in [401, 403]
        print("SUCCESS: Follow-up date update requires authentication")
    
    def test_follow_ups_due_requires_auth(self):
        """Test GET /api/channels/follow-ups/due requires auth"""
        response = requests.get(f"{BASE_URL}/api/channels/follow-ups/due")
        assert response.status_code in [401, 403]
        print("SUCCESS: Follow-ups due endpoint requires authentication")
    
    def test_channels_by_status_requires_auth(self):
        """Test GET /api/channels/by-outreach-status requires auth"""
        response = requests.get(f"{BASE_URL}/api/channels/by-outreach-status")
        assert response.status_code in [401, 403]
        print("SUCCESS: Channels by status endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
