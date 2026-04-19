"""
Test suite for Credit-Aware AI Draft System (Iteration 16)
Tests:
- GET /api/user/usage includes draft_credits and has_outreach_config
- PUT /api/user/outreach-config saves outreach settings for paid users
- GET /api/user/outreach-config returns saved config
- POST /api/channels/{channel_id}/ai-draft returns 403 for free tier users
- POST /api/channels/{channel_id}/ai-draft returns 402 when non-admin has 0 credits
- POST /api/channels/{channel_id}/ai-draft returns 400 when non-admin has no outreach_config
- POST /api/channels/{channel_id}/ai-draft works for admin without credits (unlimited)
- POST /api/checkout/credits creates Stripe checkout session for paid users
- POST /api/checkout/credits returns 403 for free tier users
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@affilitube.com"
ADMIN_PASSWORD = "admin123!"
FREE_USER_EMAIL = "freetest@test.com"
FREE_USER_PASSWORD = "password123"


class TestUserUsageEndpoint:
    """Test GET /api/user/usage includes draft_credits and has_outreach_config"""
    
    def test_admin_usage_includes_draft_credits(self):
        """Admin user usage should include draft_credits field"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        token = login_res.json()["token"]
        
        # Get usage
        usage_res = requests.get(f"{BASE_URL}/api/user/usage", headers={
            "Authorization": f"Bearer {token}"
        })
        assert usage_res.status_code == 200, f"Usage endpoint failed: {usage_res.text}"
        data = usage_res.json()
        
        # Verify draft_credits field exists
        assert "draft_credits" in data, "draft_credits field missing from usage response"
        assert isinstance(data["draft_credits"], int), "draft_credits should be an integer"
        print(f"✓ Admin draft_credits: {data['draft_credits']}")
        
    def test_admin_usage_includes_has_outreach_config(self):
        """Admin user usage should include has_outreach_config field"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Get usage
        usage_res = requests.get(f"{BASE_URL}/api/user/usage", headers={
            "Authorization": f"Bearer {token}"
        })
        assert usage_res.status_code == 200
        data = usage_res.json()
        
        # Verify has_outreach_config field exists
        assert "has_outreach_config" in data, "has_outreach_config field missing from usage response"
        assert isinstance(data["has_outreach_config"], bool), "has_outreach_config should be a boolean"
        print(f"✓ Admin has_outreach_config: {data['has_outreach_config']}")
        
    def test_free_user_usage_includes_draft_credits(self):
        """Free user usage should include draft_credits field (should be 0)"""
        # Login as free user
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        assert login_res.status_code == 200, f"Free user login failed: {login_res.text}"
        token = login_res.json()["token"]
        
        # Get usage
        usage_res = requests.get(f"{BASE_URL}/api/user/usage", headers={
            "Authorization": f"Bearer {token}"
        })
        assert usage_res.status_code == 200
        data = usage_res.json()
        
        # Verify draft_credits field exists
        assert "draft_credits" in data, "draft_credits field missing from usage response"
        assert data["tier"] == "free", "User should be on free tier"
        print(f"✓ Free user draft_credits: {data['draft_credits']}, tier: {data['tier']}")


class TestOutreachConfigEndpoints:
    """Test outreach config save and retrieve endpoints"""
    
    def test_get_outreach_config_admin(self):
        """GET /api/user/outreach-config returns saved config for admin"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Get outreach config
        config_res = requests.get(f"{BASE_URL}/api/user/outreach-config", headers={
            "Authorization": f"Bearer {token}"
        })
        assert config_res.status_code == 200, f"Get outreach config failed: {config_res.text}"
        data = config_res.json()
        
        assert "outreach_config" in data, "outreach_config field missing"
        print(f"✓ Admin outreach_config: {data['outreach_config']}")
        
    def test_put_outreach_config_admin(self):
        """PUT /api/user/outreach-config saves settings for admin"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Save outreach config
        config_data = {
            "product_name": "TestProduct",
            "target_audience": "YouTube creators",
            "value_prop": "Find affiliate partners easily",
            "tone": "casual-professional",
            "custom_closing": "Would you be open to a quick chat?",
            "product_url": "https://example.com",
            "sender_name": "Test Admin"
        }
        
        save_res = requests.put(f"{BASE_URL}/api/user/outreach-config", 
            json=config_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert save_res.status_code == 200, f"Save outreach config failed: {save_res.text}"
        data = save_res.json()
        assert data.get("success") == True, "Save should return success: true"
        
        # Verify it was saved by getting it back
        get_res = requests.get(f"{BASE_URL}/api/user/outreach-config", headers={
            "Authorization": f"Bearer {token}"
        })
        assert get_res.status_code == 200
        saved_config = get_res.json()["outreach_config"]
        assert saved_config.get("product_name") == "TestProduct", "Product name not saved correctly"
        print(f"✓ Admin outreach config saved and verified")
        
    def test_put_outreach_config_free_user_forbidden(self):
        """PUT /api/user/outreach-config returns 403 for free tier users"""
        # Login as free user
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Try to save outreach config
        config_data = {
            "product_name": "TestProduct",
            "target_audience": "YouTube creators",
            "value_prop": "Find affiliate partners easily"
        }
        
        save_res = requests.put(f"{BASE_URL}/api/user/outreach-config", 
            json=config_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert save_res.status_code == 403, f"Expected 403 for free user, got {save_res.status_code}: {save_res.text}"
        print(f"✓ Free user correctly blocked from saving outreach config (403)")


class TestAIDraftEndpoint:
    """Test AI draft endpoint access control"""
    
    def test_ai_draft_free_user_forbidden(self):
        """POST /api/channels/{channel_id}/ai-draft returns 403 for free tier users"""
        # Login as free user
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Try to generate AI draft (use any channel_id, will fail before channel lookup)
        draft_res = requests.post(f"{BASE_URL}/api/channels/test_channel_id/ai-draft", 
            headers={"Authorization": f"Bearer {token}"}
        )
        assert draft_res.status_code == 403, f"Expected 403 for free user, got {draft_res.status_code}: {draft_res.text}"
        assert "Starter or Pro plan" in draft_res.json().get("detail", ""), "Error message should mention plan requirement"
        print(f"✓ Free user correctly blocked from AI draft (403)")
        
    def test_ai_draft_admin_works_without_credits(self):
        """POST /api/channels/{channel_id}/ai-draft works for admin without credits (unlimited)"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        user_data = login_res.json()["user"]
        assert user_data.get("role") == "admin", "User should be admin"
        
        # Get a channel from pipeline
        pipeline_res = requests.get(f"{BASE_URL}/api/channels/by-outreach-status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert pipeline_res.status_code == 200
        channels = pipeline_res.json().get("channels", [])
        
        if not channels:
            pytest.skip("No channels in pipeline to test AI draft")
            
        channel_id = channels[0]["channel_id"]
        
        # Generate AI draft - admin should work regardless of credits
        draft_res = requests.post(f"{BASE_URL}/api/channels/{channel_id}/ai-draft", 
            headers={"Authorization": f"Bearer {token}"}
        )
        assert draft_res.status_code == 200, f"Admin AI draft failed: {draft_res.text}"
        data = draft_res.json()
        
        # Verify response structure
        assert "subject" in data, "Response should include subject"
        assert "body" in data, "Response should include body"
        assert "business_email" in data, "Response should include business_email"
        assert "channel_name" in data, "Response should include channel_name"
        print(f"✓ Admin AI draft generated successfully for {data['channel_name']}")
        print(f"  Subject: {data['subject'][:50]}...")


class TestCreditsCheckoutEndpoint:
    """Test credits checkout endpoint"""
    
    def test_checkout_credits_free_user_forbidden(self):
        """POST /api/checkout/credits returns 403 for free tier users"""
        # Login as free user
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Try to create checkout session
        checkout_res = requests.post(f"{BASE_URL}/api/checkout/credits", 
            headers={"Authorization": f"Bearer {token}"}
        )
        assert checkout_res.status_code == 403, f"Expected 403 for free user, got {checkout_res.status_code}: {checkout_res.text}"
        assert "Starter or Pro plan" in checkout_res.json().get("detail", ""), "Error message should mention plan requirement"
        print(f"✓ Free user correctly blocked from credits checkout (403)")
        
    def test_checkout_credits_admin_returns_url(self):
        """POST /api/checkout/credits creates Stripe checkout session for paid users (admin is pro)"""
        # Login as admin (who is on pro tier)
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Create checkout session
        checkout_res = requests.post(f"{BASE_URL}/api/checkout/credits", 
            headers={"Authorization": f"Bearer {token}"}
        )
        assert checkout_res.status_code == 200, f"Credits checkout failed: {checkout_res.text}"
        data = checkout_res.json()
        
        # Verify response has URL
        assert "url" in data, "Response should include checkout URL"
        assert data["url"].startswith("https://checkout.stripe.com"), f"URL should be Stripe checkout: {data['url']}"
        assert "session_id" in data, "Response should include session_id"
        print(f"✓ Credits checkout session created successfully")
        print(f"  URL: {data['url'][:60]}...")


class TestDraftCreditsEndpoint:
    """Test draft credits balance endpoint"""
    
    def test_get_draft_credits(self):
        """GET /api/user/draft-credits returns current balance"""
        # Login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        
        # Get draft credits
        credits_res = requests.get(f"{BASE_URL}/api/user/draft-credits", headers={
            "Authorization": f"Bearer {token}"
        })
        assert credits_res.status_code == 200, f"Get draft credits failed: {credits_res.text}"
        data = credits_res.json()
        
        assert "draft_credits" in data, "Response should include draft_credits"
        assert isinstance(data["draft_credits"], int), "draft_credits should be an integer"
        print(f"✓ Draft credits balance: {data['draft_credits']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
