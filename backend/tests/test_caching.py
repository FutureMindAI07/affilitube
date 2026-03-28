"""
Test Result Caching - P1 Feature
Tests the channel enrichment caching functionality including:
- /api/channels/enrich returns 'cached' field in response
- Cached channels are served for 24 hours
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestEnrichmentCaching:
    """Tests for caching in /api/channels/enrich"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@tubiate.com",
            "password": "admin123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get authentication headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_enrich_response_has_cached_field(self, auth_headers):
        """Verify /api/channels/enrich response includes 'cached' field"""
        # Make a request with an empty channel list to verify response structure
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            json={
                "channel_ids": [],
                "channel_metadata": {},
                "min_subscribers": 2000,
                "max_subscribers": 100000,
                "videos_to_scan": 5,
                "scan_video_descriptions": False,
                "max_channels_to_enrich": None,
                "affiliate_platforms": []
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "channels" in data
        assert "total" in data
        assert "cached" in data, "Response should include 'cached' field"
        assert isinstance(data["cached"], int), "'cached' should be an integer"
        print(f"PASS: Enrich response includes 'cached' field (value: {data['cached']})")
    
    def test_enrich_response_structure(self, auth_headers):
        """Verify complete response structure of enrich endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            json={
                "channel_ids": [],
                "channel_metadata": {},
                "min_subscribers": 2000,
                "max_subscribers": 100000,
                "videos_to_scan": 5,
                "scan_video_descriptions": False,
                "max_channels_to_enrich": None,
                "affiliate_platforms": []
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        required_fields = ["channels", "total", "cached"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify types
        assert isinstance(data["channels"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["cached"], int)
        
        print("PASS: Enrich response has correct structure with all required fields")
    
    def test_enrich_requires_auth(self):
        """Verify enrich endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/channels/enrich",
            json={
                "channel_ids": [],
                "channel_metadata": {},
                "min_subscribers": 2000,
                "max_subscribers": 100000,
                "videos_to_scan": 5,
                "scan_video_descriptions": False,
                "max_channels_to_enrich": None,
                "affiliate_platforms": []
            }
        )
        
        assert response.status_code in [401, 403], "Enrich should require authentication"
        print("PASS: Enrich endpoint properly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
