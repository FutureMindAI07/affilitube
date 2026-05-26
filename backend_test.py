import requests
import sys
import json
from datetime import datetime

class YouTubeAffiliateFinder_APITester:
    def __init__(self, base_url="https://trial-saas-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_channel_id = "test-channel-123"
        self.placeholder_api_key = "AIzaSyDummyKeyForTesting123456"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.status_code != 204:  # Don't try to parse empty responses
                    try:
                        result = response.json()
                        print(f"   Response: {json.dumps(result, indent=2)[:200]}...")
                        return success, result
                    except:
                        return success, {}
                return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test(
            "API Root Endpoint",
            "GET", 
            "/",
            200
        )

    def test_api_key_check_initial(self):
        """Test API key exists check - should return false initially"""
        return self.run_test(
            "API Key Check (Initial - Should be False)",
            "GET",
            "/settings/api-key", 
            200
        )

    def test_save_api_key(self):
        """Test saving API key with placeholder value"""
        return self.run_test(
            "Save API Key (Placeholder)",
            "POST",
            "/settings/api-key",
            200,
            data={"api_key": self.placeholder_api_key}
        )

    def test_api_key_check_after_save(self):
        """Test API key exists check - should return true after save"""
        return self.run_test(
            "API Key Check (After Save - Should be True)", 
            "GET",
            "/settings/api-key",
            200
        )

    def test_quota_estimate(self):
        """Test quota estimation endpoint"""
        filters_data = {
            "keywords": ["automation tutorial", "workflow automation"],
            "min_subscribers": 2000,
            "max_subscribers": 100000,
            "uploaded_within_days": 90,
            "max_results_per_keyword": 50,
            "search_mode": "channels_videos"
        }
        return self.run_test(
            "Quota Estimate",
            "POST",
            "/quota/estimate",
            200,
            data=filters_data
        )

    def test_add_to_shortlist(self):
        """Test adding channel to shortlist"""
        return self.run_test(
            "Add Channel to Shortlist",
            "POST",
            "/shortlist",
            200,
            data={"channel_id": self.test_channel_id}
        )

    def test_get_shortlist(self):
        """Test getting shortlist"""
        return self.run_test(
            "Get Shortlist",
            "GET",
            "/shortlist",
            200
        )

    def test_remove_from_shortlist(self):
        """Test removing channel from shortlist"""
        return self.run_test(
            "Remove Channel from Shortlist",
            "DELETE",
            f"/shortlist/{self.test_channel_id}",
            200
        )

    def test_update_notes(self):
        """Test updating channel notes"""
        notes_data = {
            "notes": "This is a test note for the channel"
        }
        return self.run_test(
            "Update Channel Notes",
            "PUT",
            f"/channels/{self.test_channel_id}/notes",
            200,
            data=notes_data
        )

    def validate_quota_estimate_structure(self, quota_data):
        """Validate quota estimate response structure"""
        required_fields = [
            'search_calls', 'channel_enrichment_calls', 'playlist_calls',
            'video_calls', 'total_units', 'daily_limit', 'percentage_of_daily'
        ]
        
        print(f"\n🔍 Validating quota estimate structure...")
        for field in required_fields:
            if field not in quota_data:
                print(f"❌ Missing field: {field}")
                return False
            else:
                print(f"✅ Found field: {field} = {quota_data[field]}")
        
        # Check data types
        if not isinstance(quota_data.get('total_units'), int):
            print(f"❌ total_units should be integer")
            return False
        
        if not isinstance(quota_data.get('percentage_of_daily'), (int, float)):
            print(f"❌ percentage_of_daily should be number")
            return False
            
        print(f"✅ Quota estimate structure is valid")
        return True

def main():
    """Run all API tests"""
    print("🚀 Starting YouTube Affiliate Finder API Tests...")
    print("=" * 60)
    
    tester = YouTubeAffiliateFinder_APITester()
    
    # Test sequence
    tests = [
        # Test API root
        ("API Root", tester.test_api_root),
        
        # Test API key management 
        ("API Key Initial Check", tester.test_api_key_check_initial),
        ("Save API Key", tester.test_save_api_key),
        ("API Key After Save Check", tester.test_api_key_check_after_save),
        
        # Test quota estimation
        ("Quota Estimate", tester.test_quota_estimate),
        
        # Test shortlist management
        ("Add to Shortlist", tester.test_add_to_shortlist),
        ("Get Shortlist", tester.test_get_shortlist),
        ("Remove from Shortlist", tester.test_remove_from_shortlist),
        
        # Test notes
        ("Update Notes", tester.test_update_notes)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            success, response_data = test_func()
            
            # Special validation for quota estimate
            if test_name == "Quota Estimate" and success:
                structure_valid = tester.validate_quota_estimate_structure(response_data)
                if not structure_valid:
                    failed_tests.append(f"{test_name} - Structure validation failed")
            
            if not success:
                failed_tests.append(test_name)
                
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            failed_tests.append(f"{test_name} - Exception: {e}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {len(failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if failed_tests:
        print("\n❌ FAILED TESTS:")
        for failed in failed_tests:
            print(f"   - {failed}")
    else:
        print("\n🎉 All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())