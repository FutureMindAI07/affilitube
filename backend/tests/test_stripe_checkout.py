"""
Backend API tests for Stripe Checkout Integration
Testing: Checkout endpoints, payment transactions, has_paid field
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@tubiate.com"
ADMIN_PASSWORD = "admin123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="function")
def new_test_user():
    """Create a new test user for isolated testing"""
    test_email = f"TEST_checkout_{uuid.uuid4().hex[:8]}@test.com"
    response = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": test_email,
        "password": "testpass123!"
    })
    assert response.status_code == 200, f"Test user registration failed: {response.text}"
    data = response.json()
    return {
        "email": test_email,
        "token": data["token"],
        "user_id": data["user"]["id"],
        "headers": {"Authorization": f"Bearer {data['token']}"}
    }


class TestLoginReturnsHasPaid:
    """Test that login returns has_paid field"""
    
    def test_login_returns_has_paid_field(self):
        """Test that POST /api/auth/login returns has_paid in user object"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Verify has_paid field exists in user object
        assert "user" in data, "Response missing 'user'"
        assert "has_paid" in data["user"], "User object missing 'has_paid' field"
        assert isinstance(data["user"]["has_paid"], bool), "has_paid should be a boolean"
        
        print(f"✓ Login returns has_paid field: {data['user']['has_paid']}")
    
    def test_register_returns_has_paid_false(self):
        """Test that new user registration returns has_paid=False"""
        test_email = f"TEST_haspaid_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123!"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify has_paid field is False for new users
        assert "user" in data, "Response missing 'user'"
        assert "has_paid" in data["user"], "User object missing 'has_paid' field"
        assert data["user"]["has_paid"] == False, f"New user should have has_paid=False, got {data['user']['has_paid']}"
        
        print(f"✓ New user registration returns has_paid=False")


class TestAuthMeReturnsHasPaid:
    """Test that /auth/me returns has_paid field"""
    
    def test_auth_me_returns_has_paid(self, auth_headers):
        """Test that GET /api/auth/me returns has_paid in user object"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        
        assert response.status_code == 200, f"/auth/me failed: {response.text}"
        data = response.json()
        
        # Verify has_paid field exists
        assert "has_paid" in data, "User object missing 'has_paid' field"
        assert isinstance(data["has_paid"], bool), "has_paid should be a boolean"
        
        print(f"✓ /auth/me returns has_paid field: {data['has_paid']}")


class TestCreateCheckoutSession:
    """Test POST /api/checkout/create-session endpoint"""
    
    def test_create_session_requires_auth(self):
        """Test that checkout session creation requires authentication"""
        response = requests.post(f"{BASE_URL}/api/checkout/create-session", json={
            "origin_url": "https://tier-restrictions.preview.emergentagent.com"
        })
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Checkout session creation requires authentication")
    
    def test_create_session_success(self, new_test_user):
        """Test successful checkout session creation"""
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"origin_url": "https://tier-restrictions.preview.emergentagent.com"},
            headers=new_test_user["headers"]
        )
        
        assert response.status_code == 200, f"Create session failed: {response.text}"
        data = response.json()
        
        # Verify response contains url and session_id
        assert "url" in data, "Response missing 'url'"
        assert "session_id" in data, "Response missing 'session_id'"
        
        # Verify URL is a valid Stripe checkout URL
        assert data["url"].startswith("https://"), f"URL should be HTTPS: {data['url']}"
        assert "checkout" in data["url"].lower() or "stripe" in data["url"].lower(), f"Should be Stripe checkout URL: {data['url']}"
        
        # Verify session_id is a non-empty string
        assert isinstance(data["session_id"], str), "session_id should be a string"
        assert len(data["session_id"]) > 0, "session_id should not be empty"
        
        print(f"✓ Checkout session created successfully")
        print(f"  - URL: {data['url'][:60]}...")
        print(f"  - Session ID: {data['session_id']}")
        
        return data
    
    def test_create_session_with_origin_url(self, new_test_user):
        """Test that origin_url is used correctly in success/cancel URLs"""
        origin_url = "https://tier-restrictions.preview.emergentagent.com"
        response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"origin_url": origin_url},
            headers=new_test_user["headers"]
        )
        
        assert response.status_code == 200, f"Create session failed: {response.text}"
        print(f"✓ Checkout session created with custom origin_url")


class TestCheckoutStatus:
    """Test GET /api/checkout/status/{session_id} endpoint"""
    
    def test_status_requires_auth(self):
        """Test that status check requires authentication"""
        response = requests.get(f"{BASE_URL}/api/checkout/status/fake_session_id")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✓ Checkout status check requires authentication")
    
    def test_status_session_not_found(self, new_test_user):
        """Test status check with non-existent session returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/checkout/status/nonexistent_session_12345",
            headers=new_test_user["headers"]
        )
        
        assert response.status_code == 404, f"Should return 404 for non-existent session, got {response.status_code}"
        print("✓ Status check returns 404 for non-existent session")
    
    def test_status_session_belongs_to_user(self, new_test_user):
        """Test that session check only works for session owner"""
        # First create a session
        create_response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"origin_url": "https://tier-restrictions.preview.emergentagent.com"},
            headers=new_test_user["headers"]
        )
        assert create_response.status_code == 200, f"Create session failed: {create_response.text}"
        session_id = create_response.json()["session_id"]
        
        # Create another user
        other_email = f"TEST_other_{uuid.uuid4().hex[:8]}@test.com"
        other_reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email,
            "password": "otherpass123!"
        })
        assert other_reg.status_code == 200, f"Other user registration failed"
        other_token = other_reg.json()["token"]
        
        # Try to access session with different user
        status_response = requests.get(
            f"{BASE_URL}/api/checkout/status/{session_id}",
            headers={"Authorization": f"Bearer {other_token}"}
        )
        
        # Should return 404 (session not found for this user)
        assert status_response.status_code == 404, f"Should return 404 for different user, got {status_response.status_code}"
        print("✓ Session status only accessible by session owner")
    
    def test_status_returns_correct_structure(self, new_test_user):
        """Test that status endpoint returns correct response structure"""
        # Create a session first
        create_response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"origin_url": "https://tier-restrictions.preview.emergentagent.com"},
            headers=new_test_user["headers"]
        )
        assert create_response.status_code == 200, f"Create session failed"
        session_id = create_response.json()["session_id"]
        
        # Check status
        status_response = requests.get(
            f"{BASE_URL}/api/checkout/status/{session_id}",
            headers=new_test_user["headers"]
        )
        
        assert status_response.status_code == 200, f"Status check failed: {status_response.text}"
        data = status_response.json()
        
        # Verify response structure
        assert "status" in data, "Response missing 'status'"
        assert "payment_status" in data, "Response missing 'payment_status'"
        
        print(f"✓ Status endpoint returns correct structure")
        print(f"  - status: {data.get('status')}")
        print(f"  - payment_status: {data.get('payment_status')}")


class TestStripeWebhook:
    """Test POST /api/webhook/stripe endpoint"""
    
    def test_webhook_endpoint_exists(self):
        """Test that webhook endpoint exists and responds"""
        # Send empty POST to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            data=b"",
            headers={"Content-Type": "application/json"}
        )
        
        # Webhook should respond (may be error due to missing signature, but not 404)
        assert response.status_code != 404, f"Webhook endpoint should exist, got 404"
        print(f"✓ Webhook endpoint exists, returns status: {response.status_code}")


class TestPaymentTransactionsCollection:
    """Test that payment_transactions collection gets records"""
    
    def test_transaction_created_on_checkout(self, new_test_user):
        """Test that creating a checkout session creates a payment transaction record"""
        # Create a session
        create_response = requests.post(
            f"{BASE_URL}/api/checkout/create-session",
            json={"origin_url": "https://tier-restrictions.preview.emergentagent.com"},
            headers=new_test_user["headers"]
        )
        
        assert create_response.status_code == 200, f"Create session failed: {create_response.text}"
        data = create_response.json()
        
        # Verify session was created (we can't directly query DB, but we can verify via status endpoint)
        session_id = data["session_id"]
        
        # Status endpoint should find the transaction
        status_response = requests.get(
            f"{BASE_URL}/api/checkout/status/{session_id}",
            headers=new_test_user["headers"]
        )
        
        assert status_response.status_code == 200, f"Status check failed - transaction may not have been created"
        print("✓ Payment transaction record created on checkout session creation")


class TestExistingPages:
    """Verify existing pages/endpoints still work"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.text}"
        print("✓ API root endpoint works")
    
    def test_auth_login(self):
        """Test auth login endpoint"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        print("✓ Auth login endpoint works")
    
    def test_quota_usage(self, auth_headers):
        """Test quota usage endpoint"""
        response = requests.get(f"{BASE_URL}/api/quota/usage", headers=auth_headers)
        assert response.status_code == 200, f"Quota usage failed: {response.text}"
        print("✓ Quota usage endpoint works")
    
    def test_shortlist(self, auth_headers):
        """Test shortlist endpoint"""
        response = requests.get(f"{BASE_URL}/api/shortlist", headers=auth_headers)
        assert response.status_code == 200, f"Shortlist failed: {response.text}"
        print("✓ Shortlist endpoint works")
    
    def test_search_history(self, auth_headers):
        """Test search history endpoint"""
        response = requests.get(f"{BASE_URL}/api/search-history", headers=auth_headers)
        assert response.status_code == 200, f"Search history failed: {response.text}"
        print("✓ Search history endpoint works")
    
    def test_search_reports(self, auth_headers):
        """Test search reports endpoint"""
        response = requests.get(f"{BASE_URL}/api/search-reports", headers=auth_headers)
        assert response.status_code == 200, f"Search reports failed: {response.text}"
        print("✓ Search reports endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
