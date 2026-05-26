#!/usr/bin/env python3
"""
Debug feature gating tests
"""

import requests
import json

# Test credentials
base_url = "https://trial-saas-hub.preview.emergentagent.com"
api_url = f"{base_url}/api"

def login_free_user():
    """Login as free user and get token"""
    login_data = {
        "email": "freeuser@test.com",
        "password": "test123!"
    }
    
    response = requests.post(f"{api_url}/auth/login", json=login_data)
    print(f"Login response: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Login data: {json.dumps(data, indent=2)}")
        return data.get("token")
    else:
        print(f"Login failed: {response.text}")
        return None

def test_csv_export(token):
    """Test CSV export with free user"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test with list of channel IDs
    export_data = ["test123", "test456"]
    
    print(f"\nTesting CSV export...")
    print(f"URL: {api_url}/export/csv")
    print(f"Data: {export_data}")
    print(f"Headers: {headers}")
    
    response = requests.post(f"{api_url}/export/csv", json=export_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response text: {response.text}")
    
    return response.status_code == 403

def test_search_history(token):
    """Test search history save with free user"""
    headers = {"Authorization": f"Bearer {token}"}
    
    search_data = {
        "name": "Test Search",
        "keywords": ["automation", "workflow"],
        "filters": {"niche": "saas_software"},
        "results_count": 5
    }
    
    print(f"\nTesting search history...")
    print(f"URL: {api_url}/search-history")
    print(f"Data: {json.dumps(search_data, indent=2)}")
    
    response = requests.post(f"{api_url}/search-history", json=search_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response text: {response.text}")
    
    return response.status_code == 403

def test_search_reports(token):
    """Test search reports save with free user"""
    headers = {"Authorization": f"Bearer {token}"}
    
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
    
    print(f"\nTesting search reports...")
    print(f"URL: {api_url}/search-reports")
    print(f"Data: {json.dumps(report_data, indent=2)}")
    
    response = requests.post(f"{api_url}/search-reports", json=report_data, headers=headers)
    print(f"Response status: {response.status_code}")
    print(f"Response text: {response.text}")
    
    return response.status_code == 403

def main():
    print("🔍 Debug Feature Gating Tests...")
    
    # Login as free user
    token = login_free_user()
    if not token:
        print("❌ Failed to login")
        return
    
    # Test feature gating
    csv_blocked = test_csv_export(token)
    history_blocked = test_search_history(token)
    reports_blocked = test_search_reports(token)
    
    print(f"\n📊 Results:")
    print(f"CSV Export blocked: {'✅' if csv_blocked else '❌'}")
    print(f"Search History blocked: {'✅' if history_blocked else '❌'}")
    print(f"Search Reports blocked: {'✅' if reports_blocked else '❌'}")

if __name__ == "__main__":
    main()