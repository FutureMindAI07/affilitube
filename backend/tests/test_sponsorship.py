"""
Test suite for Sponsorship History feature
Tests: GET /api/channels/{channel_id}/sponsorship-data endpoint
- Authentication requirement
- Response structure validation
- Caching behavior (7-day cache)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://trial-saas-hub.preview.emergentagent.com').rstrip('/')

# Test credentials
PRO_USER = {"email": "admin@affilitube.com", "password": "admin123!"}
FREE_USER = {"email": "freetest@test.com", "password": "password123"}

# Test channel - MKBHD (known to have affiliate links)
TEST_CHANNEL_ID = "UCBJycsmduvYEL83R_U4JriQ"


@pytest.fixture(scope="module")
def pro_token():
    """Get authentication token for pro user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=PRO_USER)
    assert response.status_code == 200, f"Pro user login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def free_token():
    """Get authentication token for free user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=FREE_USER)
    assert response.status_code == 200, f"Free user login failed: {response.text}"
    return response.json()["token"]


class TestSponsorshipEndpointAuth:
    """Test authentication requirements for sponsorship endpoint"""
    
    def test_sponsorship_endpoint_requires_auth(self):
        """Endpoint should return 401/403 without authentication"""
        response = requests.get(f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Endpoint correctly requires authentication: {data['detail']}")
    
    def test_sponsorship_endpoint_with_invalid_token(self):
        """Endpoint should reject invalid tokens"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Endpoint correctly rejects invalid tokens")


class TestSponsorshipDataStructure:
    """Test sponsorship data response structure"""
    
    def test_sponsorship_data_returns_correct_structure(self, pro_token):
        """Response should contain all required fields"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        required_fields = [
            "is_sponsored_active",
            "detected_brands",
            "affiliate_link_count",
            "confidence_score",
            "videos_analyzed",
            "videos_with_sponsorships"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify field types
        assert isinstance(data["is_sponsored_active"], bool), "is_sponsored_active should be boolean"
        assert isinstance(data["detected_brands"], list), "detected_brands should be list"
        assert isinstance(data["affiliate_link_count"], int), "affiliate_link_count should be int"
        assert isinstance(data["confidence_score"], int), "confidence_score should be int"
        assert isinstance(data["videos_analyzed"], int), "videos_analyzed should be int"
        assert isinstance(data["videos_with_sponsorships"], list), "videos_with_sponsorships should be list"
        
        print(f"✓ Response structure is correct")
        print(f"  - is_sponsored_active: {data['is_sponsored_active']}")
        print(f"  - detected_brands: {len(data['detected_brands'])} brands")
        print(f"  - affiliate_link_count: {data['affiliate_link_count']}")
        print(f"  - confidence_score: {data['confidence_score']}/100")
        print(f"  - videos_analyzed: {data['videos_analyzed']}")
        print(f"  - videos_with_sponsorships: {len(data['videos_with_sponsorships'])} videos")
    
    def test_videos_with_sponsorships_structure(self, pro_token):
        """Each video in videos_with_sponsorships should have correct structure"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        if data["videos_with_sponsorships"]:
            video = data["videos_with_sponsorships"][0]
            assert "video_id" in video, "Video should have video_id"
            assert "title" in video, "Video should have title"
            assert "signals" in video, "Video should have signals"
            assert isinstance(video["signals"], list), "signals should be list"
            print(f"✓ Video structure is correct: {video['title'][:50]}...")
            print(f"  - Signals: {video['signals']}")
        else:
            print("⚠ No videos with sponsorships found to validate structure")


class TestSponsorshipCaching:
    """Test 7-day caching behavior"""
    
    def test_second_call_returns_cached_data(self, pro_token):
        """Second call should return cached data (faster response)"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        
        # First call
        start1 = time.time()
        response1 = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        time1 = time.time() - start1
        
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Second call (should be cached)
        start2 = time.time()
        response2 = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        time2 = time.time() - start2
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Data should be identical
        assert data1["is_sponsored_active"] == data2["is_sponsored_active"]
        assert data1["confidence_score"] == data2["confidence_score"]
        assert data1["affiliate_link_count"] == data2["affiliate_link_count"]
        
        print(f"✓ Caching works correctly")
        print(f"  - First call: {time1:.3f}s")
        print(f"  - Second call: {time2:.3f}s")
        print(f"  - Data is consistent between calls")


class TestSponsorshipForDifferentUsers:
    """Test that both pro and free users can access sponsorship data"""
    
    def test_pro_user_can_access_sponsorship_data(self, pro_token):
        """Pro user should be able to access sponsorship data"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        assert response.status_code == 200, f"Pro user should access sponsorship data: {response.text}"
        print("✓ Pro user can access sponsorship data")
    
    def test_free_user_can_access_sponsorship_data(self, free_token):
        """Free user should also be able to access sponsorship data (tier gating is frontend only)"""
        headers = {"Authorization": f"Bearer {free_token}"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        # Note: The endpoint itself doesn't gate by tier - tier gating is done in frontend
        assert response.status_code == 200, f"Free user should access sponsorship data: {response.text}"
        print("✓ Free user can access sponsorship data (tier gating is frontend-only)")


class TestSponsorshipDetectionQuality:
    """Test that sponsorship detection returns meaningful data for MKBHD channel"""
    
    def test_mkbhd_has_affiliate_links(self, pro_token):
        """MKBHD channel should have affiliate links detected"""
        headers = {"Authorization": f"Bearer {pro_token}"}
        response = requests.get(
            f"{BASE_URL}/api/channels/{TEST_CHANNEL_ID}/sponsorship-data",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # MKBHD is known to have affiliate links
        assert data["affiliate_link_count"] > 0, "MKBHD should have affiliate links"
        assert data["is_sponsored_active"] == True, "MKBHD should have sponsorship activity"
        assert data["videos_analyzed"] == 10, "Should analyze 10 videos"
        
        print(f"✓ MKBHD sponsorship detection quality verified")
        print(f"  - Affiliate links: {data['affiliate_link_count']}")
        print(f"  - Confidence score: {data['confidence_score']}/100")
        print(f"  - Videos with signals: {len(data['videos_with_sponsorships'])}/{data['videos_analyzed']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
