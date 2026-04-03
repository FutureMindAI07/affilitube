"""
Stripe Integration Tests - Iteration 11
Tests for real Stripe checkout sessions, webhook endpoint, and billing portal
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


class TestStripeCheckout:
    """Tests for /api/checkout/create-session endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_free_user_token(self):
        """Get token for free tier user"""
        # First try to login
        res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        
        # If login fails, create the user
        res = self.session.post(f"{BASE_URL}/api/auth/signup", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code in [200, 201]:
            return res.json().get("token")
        
        # Try login again after signup
        res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        
        pytest.skip(f"Could not get free user token: {res.text}")
    
    def get_admin_token(self):
        """Get token for admin (pro tier) user"""
        res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        pytest.skip(f"Could not get admin token: {res.text}")
    
    # ===== STARTER MONTHLY CHECKOUT =====
    def test_checkout_starter_monthly_returns_valid_stripe_url(self):
        """POST /api/checkout/create-session with plan=starter_monthly returns valid Stripe checkout URL"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "starter_monthly"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        # Validate response structure
        assert "url" in data, "Response should contain 'url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        
        # Validate Stripe URL
        assert data["url"].startswith("https://checkout.stripe.com/"), f"URL should be Stripe checkout: {data['url']}"
        assert data["session_id"].startswith("cs_"), f"Session ID should start with 'cs_': {data['session_id']}"
        
        print(f"✓ starter_monthly checkout URL: {data['url'][:80]}...")
    
    # ===== STARTER ANNUAL CHECKOUT =====
    def test_checkout_starter_annual_returns_valid_stripe_url(self):
        """POST /api/checkout/create-session with plan=starter_annual returns valid Stripe checkout URL"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "starter_annual"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        assert "url" in data, "Response should contain 'url'"
        assert data["url"].startswith("https://checkout.stripe.com/"), f"URL should be Stripe checkout: {data['url']}"
        
        print(f"✓ starter_annual checkout URL: {data['url'][:80]}...")
    
    # ===== PRO MONTHLY CHECKOUT =====
    def test_checkout_pro_monthly_returns_valid_stripe_url(self):
        """POST /api/checkout/create-session with plan=pro_monthly returns valid Stripe checkout URL"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "pro_monthly"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        assert "url" in data, "Response should contain 'url'"
        assert data["url"].startswith("https://checkout.stripe.com/"), f"URL should be Stripe checkout: {data['url']}"
        
        print(f"✓ pro_monthly checkout URL: {data['url'][:80]}...")
    
    # ===== PRO ANNUAL CHECKOUT =====
    def test_checkout_pro_annual_returns_valid_stripe_url(self):
        """POST /api/checkout/create-session with plan=pro_annual returns valid Stripe checkout URL"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "pro_annual"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        
        assert "url" in data, "Response should contain 'url'"
        assert data["url"].startswith("https://checkout.stripe.com/"), f"URL should be Stripe checkout: {data['url']}"
        
        print(f"✓ pro_annual checkout URL: {data['url'][:80]}...")
    
    # ===== INVALID PLAN =====
    def test_checkout_invalid_plan_returns_400(self):
        """POST /api/checkout/create-session with plan=invalid_plan returns 400 error"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "invalid_plan"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        data = res.json()
        assert "detail" in data, "Response should contain error detail"
        
        print(f"✓ Invalid plan correctly rejected: {data['detail']}")
    
    # ===== PRO USER CHECKOUT BLOCKED =====
    def test_pro_user_checkout_blocked(self):
        """Pro user (admin) trying to checkout gets 'already have Pro access' error"""
        token = self.get_admin_token()
        res = self.session.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"plan": "pro_monthly"},
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        data = res.json()
        assert "detail" in data, "Response should contain error detail"
        assert "already have Pro access" in data["detail"].lower() or "pro access" in data["detail"].lower(), \
            f"Error should mention Pro access: {data['detail']}"
        
        print(f"✓ Pro user checkout correctly blocked: {data['detail']}")


class TestStripeWebhook:
    """Tests for /api/webhook/stripe endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_webhook_endpoint_exists_and_rejects_invalid_signature(self):
        """POST /api/webhook/stripe endpoint exists and returns 400 for invalid signature"""
        # Send a fake webhook with invalid signature
        res = self.session.post(
            f"{BASE_URL}/api/webhook/stripe",
            data='{"type": "checkout.session.completed", "data": {"object": {}}}',
            headers={
                "Content-Type": "application/json",
                "Stripe-Signature": "invalid_signature_12345"
            }
        )
        
        # Should return 400 for invalid signature (not 404 or 500)
        assert res.status_code == 400, f"Expected 400 for invalid signature, got {res.status_code}: {res.text}"
        data = res.json()
        assert "detail" in data, "Response should contain error detail"
        
        print(f"✓ Webhook correctly rejects invalid signature: {data['detail']}")


class TestBillingPortal:
    """Tests for /api/billing/portal-session endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def get_free_user_token(self):
        """Get token for free tier user"""
        res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        
        # Create user if doesn't exist
        res = self.session.post(f"{BASE_URL}/api/auth/signup", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code in [200, 201]:
            return res.json().get("token")
        
        res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": FREE_USER_EMAIL,
            "password": FREE_USER_PASSWORD
        })
        if res.status_code == 200:
            return res.json().get("token")
        
        pytest.skip(f"Could not get free user token: {res.text}")
    
    def test_billing_portal_returns_400_for_free_user(self):
        """POST /api/billing/portal-session returns 400 for free tier user"""
        token = self.get_free_user_token()
        res = self.session.post(
            f"{BASE_URL}/api/billing/portal-session",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"
        data = res.json()
        assert "detail" in data, "Response should contain error detail"
        
        print(f"✓ Billing portal correctly blocked for free user: {data['detail']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
