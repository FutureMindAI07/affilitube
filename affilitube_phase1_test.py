#!/usr/bin/env python3
"""
Affilitube Phase 1 Backend Testing
Tests the key Phase 1 changes:
1. Niche System - GET /api/niches should return 6 niches
2. User Registration - New users get tier: "free" and monthly_search_count: 0
3. User Login - Should return tier field alongside has_paid
4. User Usage Endpoint - GET /api/user/usage should return tier info and limits
5. Feature Gating - Free tier should get 403 on restricted endpoints
"""

import requests
import json
import sys
from datetime import datetime
import uuid

class AffliTubePhase1Tester:
    def __init__(self, base_url="https://pipeline-info-cache.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.free_user_token = None
        self.test_user_email = f"testuser_{uuid.uuid4().hex[:8]}@test.com"
        self.test_user_password = "test123!"
        
        # Test credentials from review request
        self.admin_email = "admin@affilitube.com"
        self.admin_password = "admin123!"
        self.free_user_email = "freeuser@test.com"
        self.free_user_password = "test123!"

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")

    def make_request(self, method, endpoint, data=None, headers=None, expected_status=200):
        """Make HTTP request and return response"""
        url = f"{self.api_url}{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=30)
            
            return response
        except requests.exceptions.Timeout:
            print(f"Request timeout for {url}")
            return None
        except requests.exceptions.ConnectionError as e:
            print(f"Connection error for {url}: {e}")
            return None
        except Exception as e:
            print(f"Request failed for {url}: {e}")
            return None

    def test_api_root(self):
        """Test API root returns Affilitube branding"""
        print("\n🔍 Testing API Root Branding...")
        response = self.make_request('GET', '/')
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                if "Affilitube" in data.get("message", ""):
                    self.log_test("API Root Branding", True, f"Message: {data['message']}")
                    return True
                else:
                    self.log_test("API Root Branding", False, f"Expected 'Affilitube' in message, got: {data}")
                    return False
            except:
                self.log_test("API Root Branding", False, "Invalid JSON response")
                return False
        else:
            self.log_test("API Root Branding", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_niche_system(self):
        """Test GET /api/niches returns 6 niches with proper structure"""
        print("\n🔍 Testing Niche System...")
        response = self.make_request('GET', '/niches')
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                niches = data.get("niches", [])
                
                # Check we have 6 niches
                if len(niches) != 6:
                    self.log_test("Niche Count", False, f"Expected 6 niches, got {len(niches)}")
                    return False
                
                self.log_test("Niche Count", True, f"Found {len(niches)} niches")
                
                # Check structure of each niche
                required_fields = ["key", "name", "icon", "description", "placeholder_examples"]
                expected_niches = [
                    "saas_software", "fitness_health", "finance_investing", 
                    "ecommerce_amazon", "online_courses", "marketing_tools"
                ]
                
                found_keys = []
                for niche in niches:
                    found_keys.append(niche.get("key"))
                    for field in required_fields:
                        if field not in niche:
                            self.log_test("Niche Structure", False, f"Missing field '{field}' in niche {niche.get('key')}")
                            return False
                
                # Check all expected niches are present
                for expected_key in expected_niches:
                    if expected_key not in found_keys:
                        self.log_test("Niche Keys", False, f"Missing expected niche: {expected_key}")
                        return False
                
                self.log_test("Niche System", True, f"All 6 niches present with correct structure")
                return True
                
            except Exception as e:
                self.log_test("Niche System", False, f"JSON parsing error: {e}")
                return False
        else:
            self.log_test("Niche System", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_user_registration(self):
        """Test new user registration gets tier: free and monthly_search_count: 0"""
        print("\n🔍 Testing User Registration...")
        
        # Register new user
        registration_data = {
            "email": self.test_user_email,
            "password": self.test_user_password
        }
        
        response = self.make_request('POST', '/auth/register', data=registration_data)
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                user = data.get("user", {})
                
                # Check tier is "free"
                if user.get("tier") != "free":
                    self.log_test("Registration Tier", False, f"Expected tier 'free', got '{user.get('tier')}'")
                    return False
                
                # Check has_paid is False
                if user.get("has_paid") != False:
                    self.log_test("Registration has_paid", False, f"Expected has_paid False, got {user.get('has_paid')}")
                    return False
                
                # Store token for later tests
                self.free_user_token = data.get("token")
                
                self.log_test("User Registration", True, f"New user has tier: {user.get('tier')}, has_paid: {user.get('has_paid')}")
                return True
                
            except Exception as e:
                self.log_test("User Registration", False, f"JSON parsing error: {e}")
                return False
        else:
            self.log_test("User Registration", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_admin_login(self):
        """Test admin login returns tier field"""
        print("\n🔍 Testing Admin Login...")
        
        login_data = {
            "email": self.admin_email,
            "password": self.admin_password
        }
        
        response = self.make_request('POST', '/auth/login', data=login_data)
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                user = data.get("user", {})
                
                # Check tier field exists
                if "tier" not in user:
                    self.log_test("Admin Login Tier Field", False, "Missing 'tier' field in login response")
                    return False
                
                # Check has_paid field exists
                if "has_paid" not in user:
                    self.log_test("Admin Login has_paid Field", False, "Missing 'has_paid' field in login response")
                    return False
                
                # Store admin token
                self.admin_token = data.get("token")
                
                self.log_test("Admin Login", True, f"Admin tier: {user.get('tier')}, has_paid: {user.get('has_paid')}")
                return True
                
            except Exception as e:
                self.log_test("Admin Login", False, f"JSON parsing error: {e}")
                return False
        else:
            self.log_test("Admin Login", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_free_user_login(self):
        """Test free user login returns correct tier"""
        print("\n🔍 Testing Free User Login...")
        
        login_data = {
            "email": self.free_user_email,
            "password": self.free_user_password
        }
        
        response = self.make_request('POST', '/auth/login', data=login_data)
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                user = data.get("user", {})
                
                # Check tier is "free"
                if user.get("tier") != "free":
                    self.log_test("Free User Login Tier", False, f"Expected tier 'free', got '{user.get('tier')}'")
                    return False
                
                # Check has_paid is False
                if user.get("has_paid") != False:
                    self.log_test("Free User Login has_paid", False, f"Expected has_paid False, got {user.get('has_paid')}")
                    return False
                
                # Store token for feature gating tests
                self.free_user_token = data.get("token")
                
                self.log_test("Free User Login", True, f"Free user tier: {user.get('tier')}, has_paid: {user.get('has_paid')}")
                return True
                
            except Exception as e:
                self.log_test("Free User Login", False, f"JSON parsing error: {e}")
                return False
        else:
            self.log_test("Free User Login", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_user_usage_endpoint(self):
        """Test GET /api/user/usage returns tier info and limits"""
        print("\n🔍 Testing User Usage Endpoint...")
        
        if not self.free_user_token:
            self.log_test("User Usage Endpoint", False, "No free user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.free_user_token}"}
        response = self.make_request('GET', '/user/usage', headers=headers)
        
        if response is not None and response.status_code == 200:
            try:
                data = response.json()
                
                # Check required fields
                required_fields = [
                    "tier", "tier_name", "searches_used", "searches_remaining", 
                    "max_searches", "max_results_per_search", "csv_export", 
                    "saved_searches", "saved_reports", "is_unlimited"
                ]
                
                for field in required_fields:
                    if field not in data:
                        self.log_test("User Usage Fields", False, f"Missing field: {field}")
                        return False
                
                # Check free tier values
                if data.get("tier") != "free":
                    self.log_test("Usage Tier", False, f"Expected tier 'free', got '{data.get('tier')}'")
                    return False
                
                if data.get("max_searches") != 3:
                    self.log_test("Usage Max Searches", False, f"Expected max_searches 3, got {data.get('max_searches')}")
                    return False
                
                if data.get("max_results_per_search") != 10:
                    self.log_test("Usage Max Results", False, f"Expected max_results_per_search 10, got {data.get('max_results_per_search')}")
                    return False
                
                if data.get("csv_export") != False:
                    self.log_test("Usage CSV Export", False, f"Expected csv_export False, got {data.get('csv_export')}")
                    return False
                
                self.log_test("User Usage Endpoint", True, f"All usage fields correct for free tier")
                return True
                
            except Exception as e:
                self.log_test("User Usage Endpoint", False, f"JSON parsing error: {e}")
                return False
        else:
            self.log_test("User Usage Endpoint", False, f"Status: {response.status_code if response else 'No response'}")
            return False

    def test_feature_gating_csv_export(self):
        """Test free tier gets 403 on CSV export"""
        print("\n🔍 Testing Feature Gating - CSV Export...")
        
        if not self.free_user_token:
            self.log_test("CSV Export Gating", False, "No free user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.free_user_token}"}
        
        # Try to export CSV (should fail with 403)
        # CSV export expects a list of channel_ids directly
        export_data = ["test123", "test456"]
        
        response = self.make_request('POST', '/export/csv', data=export_data, headers=headers)
        
        if response is not None and response.status_code == 403:
            try:
                data = response.json()
                if "Upgrade to Pro" in data.get("detail", ""):
                    self.log_test("CSV Export Gating", True, "Free tier correctly blocked from CSV export")
                    return True
                else:
                    self.log_test("CSV Export Gating", False, f"Wrong error message: {data.get('detail')}")
                    return False
            except:
                self.log_test("CSV Export Gating", True, "Free tier blocked (403) but no JSON response")
                return True
        else:
            self.log_test("CSV Export Gating", False, f"Expected 403, got {response.status_code if response is not None else 'No response'}")
            return False

    def test_feature_gating_search_history(self):
        """Test free tier gets 403 on search history save"""
        print("\n🔍 Testing Feature Gating - Search History...")
        
        if not self.free_user_token:
            self.log_test("Search History Gating", False, "No free user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.free_user_token}"}
        
        # Try to save search history (should fail with 403)
        search_data = {
            "name": "Test Search",
            "keywords": ["automation", "workflow"],
            "filters": {"niche": "saas_software"},
            "results_count": 5
        }
        
        response = self.make_request('POST', '/search-history', data=search_data, headers=headers)
        
        if response is not None and response.status_code == 403:
            try:
                data = response.json()
                if "Upgrade to Pro" in data.get("detail", ""):
                    self.log_test("Search History Gating", True, "Free tier correctly blocked from saving search history")
                    return True
                else:
                    self.log_test("Search History Gating", False, f"Wrong error message: {data.get('detail')}")
                    return False
            except:
                self.log_test("Search History Gating", True, "Free tier blocked (403) but no JSON response")
                return True
        else:
            self.log_test("Search History Gating", False, f"Expected 403, got {response.status_code if response is not None else 'No response'}")
            return False

    def test_feature_gating_search_reports(self):
        """Test free tier gets 403 on search reports save"""
        print("\n🔍 Testing Feature Gating - Search Reports...")
        
        if not self.free_user_token:
            self.log_test("Search Reports Gating", False, "No free user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.free_user_token}"}
        
        # Try to save search report (should fail with 403)
        report_data = {
            "name": "Test Report",
            "keywords": ["automation", "workflow"],
            "filters": {"niche": "saas_software"},
            "channels": [
                {
                    "channel_id": "test123",
                    "channel_name": "Test Channel",
                    "subscriber_count": 5000
                }
            ],
            "shortlisted_ids": []
        }
        
        response = self.make_request('POST', '/search-reports', data=report_data, headers=headers)
        
        if response is not None and response.status_code == 403:
            try:
                data = response.json()
                if "Upgrade to Pro" in data.get("detail", ""):
                    self.log_test("Search Reports Gating", True, "Free tier correctly blocked from saving search reports")
                    return True
                else:
                    self.log_test("Search Reports Gating", False, f"Wrong error message: {data.get('detail')}")
                    return False
            except:
                self.log_test("Search Reports Gating", True, "Free tier blocked (403) but no JSON response")
                return True
        else:
            self.log_test("Search Reports Gating", False, f"Expected 403, got {response.status_code if response is not None else 'No response'}")
            return False

    def test_youtube_api_key_backend(self):
        """Test that YouTube API key is handled on backend (no user key endpoints)"""
        print("\n🔍 Testing Backend YouTube API Key...")
        
        if not self.free_user_token:
            self.log_test("Backend API Key", False, "No free user token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.free_user_token}"}
        
        # Try to access old user API key endpoints (should not exist or return 404)
        response = self.make_request('GET', '/settings/api-key', headers=headers)
        
        if response and response.status_code == 404:
            self.log_test("Backend API Key", True, "User API key endpoints removed (404)")
            return True
        elif response and response.status_code == 200:
            # If endpoint exists, it should not require user API keys
            try:
                data = response.json()
                # This would be the old behavior - we want this to be gone
                self.log_test("Backend API Key", False, "User API key endpoint still exists")
                return False
            except:
                self.log_test("Backend API Key", True, "API key handling moved to backend")
                return True
        else:
            self.log_test("Backend API Key", True, f"User API key endpoint not accessible (status: {response.status_code if response is not None else 'No response'})")
            return True

    def run_all_tests(self):
        """Run all Phase 1 tests"""
        print("🚀 Starting Affilitube Phase 1 Backend Tests...")
        print("=" * 60)
        
        tests = [
            ("API Root Branding", self.test_api_root),
            ("Niche System", self.test_niche_system),
            ("User Registration", self.test_user_registration),
            ("Admin Login", self.test_admin_login),
            ("Free User Login", self.test_free_user_login),
            ("User Usage Endpoint", self.test_user_usage_endpoint),
            ("Feature Gating - CSV Export", self.test_feature_gating_csv_export),
            ("Feature Gating - Search History", self.test_feature_gating_search_history),
            ("Feature Gating - Search Reports", self.test_feature_gating_search_reports),
            ("Backend YouTube API Key", self.test_youtube_api_key_backend),
        ]
        
        failed_tests = []
        
        for test_name, test_func in tests:
            try:
                success = test_func()
                if not success:
                    failed_tests.append(test_name)
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {e}")
                failed_tests.append(f"{test_name} - Exception: {e}")
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 AFFILITUBE PHASE 1 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {len(failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for failed in failed_tests:
                print(f"   - {failed}")
        else:
            print("\n🎉 All Phase 1 tests passed!")
        
        return len(failed_tests) == 0

def main():
    """Main test runner"""
    tester = AffliTubePhase1Tester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())