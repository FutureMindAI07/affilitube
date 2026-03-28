"""
Backend API tests for YouTube Affiliate Prospect Finder MVP
Testing: Auth endpoints (login, register, me)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthEndpoints:
    """Tests for /api/auth/* endpoints"""
    
    def test_register_new_user(self):
        """Test registration with new email"""
        test_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "test123!"
        })
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Response missing 'token'"
        assert "user" in data, "Response missing 'user'"
        assert isinstance(data["token"], str), "Token should be a string"
        assert len(data["token"]) > 10, "Token should be non-empty"
        
        # Verify user data
        assert data["user"]["email"] == test_email.lower(), f"Email mismatch: {data['user']['email']}"
        assert "id" in data["user"], "User should have an ID"
        
        print(f"✓ Registration successful for {test_email}")
        return data
    
    def test_register_duplicate_email(self):
        """Test registration with existing email should fail"""
        # First register
        test_email = f"TEST_dup_{uuid.uuid4().hex[:8]}@test.com"
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "test123!"
        })
        assert response1.status_code == 200, "First registration should succeed"
        
        # Try to register same email again
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "differentpass!"
        })
        assert response2.status_code == 400, f"Duplicate registration should fail with 400, got {response2.status_code}"
        
        print(f"✓ Duplicate registration correctly rejected for {test_email}")
    
    def test_login_admin_user(self):
        """Test login with admin credentials"""
        # First ensure admin user exists by trying to register (will fail if exists)
        admin_email = "admin@ytfinder.com"
        admin_password = "admin123!"
        
        # Try to register admin user (may already exist)
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": admin_email,
            "password": admin_password
        })
        
        # Now try login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": admin_email,
            "password": admin_password
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "token" in data, "Response missing 'token'"
        assert "user" in data, "Response missing 'user'"
        assert data["user"]["email"] == admin_email, f"Email mismatch: {data['user']['email']}"
        
        print(f"✓ Admin login successful for {admin_email}")
        return data
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ytfinder.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Should return 401 for invalid credentials, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword"
        })
        
        assert response.status_code == 401, f"Should return 401 for non-existent user, got {response.status_code}"
        print("✓ Non-existent user login correctly rejected with 401")
    
    def test_get_me_with_valid_token(self):
        """Test /auth/me with valid token returns user data"""
        # First login to get token
        admin_email = "admin@ytfinder.com"
        admin_password = "admin123!"
        
        # Ensure admin exists
        requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": admin_email,
            "password": admin_password
        })
        
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": admin_email,
            "password": admin_password
        })
        
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json()["token"]
        
        # Now test /auth/me
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert me_response.status_code == 200, f"/auth/me failed: {me_response.text}"
        user_data = me_response.json()
        
        assert "email" in user_data, "User data should contain email"
        assert user_data["email"] == admin_email, f"Email mismatch: {user_data['email']}"
        
        print(f"✓ /auth/me returned correct user data for {admin_email}")
    
    def test_get_me_without_token(self):
        """Test /auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        # Should return 401 or 403 for unauthenticated request
        assert response.status_code in [401, 403], f"Should return 401/403 without token, got {response.status_code}"
        print("✓ /auth/me correctly rejected without token")
    
    def test_get_me_with_invalid_token(self):
        """Test /auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401, f"Should return 401 for invalid token, got {response.status_code}"
        print("✓ /auth/me correctly rejected invalid token")


class TestAPIRoot:
    """Test basic API endpoints"""
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200, f"Root endpoint failed: {response.text}"
        data = response.json()
        assert "message" in data, "Root should return message"
        
        print("✓ Root API endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
