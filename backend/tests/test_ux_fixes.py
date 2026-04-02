"""
Test suite for UX Fixes:
1. Add to Pipeline button + dialog (project_name in outreach-status)
2. Project organization in Pipeline (project filter, project-name endpoint, pipeline/projects)
3. Search results persistence (autosave endpoints)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@affilitube.com",
        "password": "admin123!"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ==================== AUTOSAVE ENDPOINTS ====================

class TestAutoSaveEndpoints:
    """Test search results auto-save functionality"""
    
    def test_autosave_post_creates_record(self, api_client):
        """POST /api/search-results/autosave saves search results"""
        test_channels = [
            {"channel_id": "TEST_ch_001", "channel_name": "Test Channel 1", "subscriber_count": 5000},
            {"channel_id": "TEST_ch_002", "channel_name": "Test Channel 2", "subscriber_count": 10000}
        ]
        test_metadata = {"niche": "saas_software", "keywords": ["test"], "timestamp": "2026-01-01T00:00:00Z"}
        
        response = api_client.post(f"{BASE_URL}/api/search-results/autosave", json={
            "channels": test_channels,
            "raw_search_results": {"channel_ids": ["TEST_ch_001", "TEST_ch_002"], "total_found": 2},
            "search_metadata": test_metadata
        })
        
        assert response.status_code == 200, f"Autosave POST failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        print("✓ POST /api/search-results/autosave - saves search results")
    
    def test_autosave_get_returns_saved_results(self, api_client):
        """GET /api/search-results/autosave returns saved results"""
        response = api_client.get(f"{BASE_URL}/api/search-results/autosave")
        
        assert response.status_code == 200, f"Autosave GET failed: {response.text}"
        data = response.json()
        assert data.get("exists") is True
        assert "channels" in data
        assert len(data["channels"]) >= 2
        assert "search_metadata" in data
        print("✓ GET /api/search-results/autosave - returns saved results")
    
    def test_autosave_delete_removes_record(self, api_client):
        """DELETE /api/search-results/autosave deletes saved results"""
        response = api_client.delete(f"{BASE_URL}/api/search-results/autosave")
        
        assert response.status_code == 200, f"Autosave DELETE failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/search-results/autosave")
        assert get_response.status_code == 200
        assert get_response.json().get("exists") is False
        print("✓ DELETE /api/search-results/autosave - deletes saved results")


# ==================== PIPELINE PROJECTS ENDPOINTS ====================

class TestPipelineProjectsEndpoints:
    """Test project organization in pipeline"""
    
    def test_pipeline_projects_endpoint_exists(self, api_client):
        """GET /api/pipeline/projects returns list of projects"""
        response = api_client.get(f"{BASE_URL}/api/pipeline/projects")
        
        assert response.status_code == 200, f"Pipeline projects GET failed: {response.text}"
        data = response.json()
        assert "projects" in data
        assert isinstance(data["projects"], list)
        print(f"✓ GET /api/pipeline/projects - returns {len(data['projects'])} projects")
    
    def test_by_outreach_status_accepts_project_filter(self, api_client):
        """GET /api/channels/by-outreach-status accepts project query param"""
        # Test with no project filter
        response = api_client.get(f"{BASE_URL}/api/channels/by-outreach-status")
        assert response.status_code == 200, f"by-outreach-status failed: {response.text}"
        
        # Test with project filter
        response_filtered = api_client.get(f"{BASE_URL}/api/channels/by-outreach-status?project=TestProject")
        assert response_filtered.status_code == 200, f"by-outreach-status with project filter failed: {response_filtered.text}"
        data = response_filtered.json()
        assert "channels" in data
        assert "status_counts" in data
        print("✓ GET /api/channels/by-outreach-status?project=X - accepts project filter")


# ==================== OUTREACH STATUS WITH PROJECT_NAME ====================

class TestOutreachStatusWithProject:
    """Test PATCH /api/channels/{id}/outreach-status with project_name field"""
    
    @pytest.fixture(scope="class")
    def test_channel_id(self, api_client):
        """Create a test channel for outreach status tests"""
        # First, check if we have any existing channels
        response = api_client.get(f"{BASE_URL}/api/channels/by-outreach-status")
        if response.status_code == 200 and response.json().get("channels"):
            return response.json()["channels"][0]["channel_id"]
        
        # If no channels, we need to create one via enrichment or return None
        # For now, skip if no channels exist
        pytest.skip("No channels available for testing - run search+enrich first")
    
    def test_outreach_status_accepts_project_name(self, api_client, test_channel_id):
        """PATCH /api/channels/{id}/outreach-status accepts project_name field"""
        test_project = f"TestProject_{uuid.uuid4().hex[:6]}"
        
        response = api_client.patch(
            f"{BASE_URL}/api/channels/{test_channel_id}/outreach-status",
            json={
                "status": "contacted",
                "note": "Testing project_name field",
                "project_name": test_project
            }
        )
        
        assert response.status_code == 200, f"Outreach status update failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert data.get("status") == "contacted"
        assert data.get("project_name") == test_project
        print(f"✓ PATCH /api/channels/{{id}}/outreach-status - accepts project_name: {test_project}")
    
    def test_project_name_update_endpoint(self, api_client, test_channel_id):
        """PATCH /api/channels/{id}/project-name updates project name"""
        new_project = f"UpdatedProject_{uuid.uuid4().hex[:6]}"
        
        response = api_client.patch(
            f"{BASE_URL}/api/channels/{test_channel_id}/project-name",
            json={"project_name": new_project}
        )
        
        assert response.status_code == 200, f"Project name update failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        assert data.get("project_name") == new_project
        print(f"✓ PATCH /api/channels/{{id}}/project-name - updates project: {new_project}")
    
    def test_project_name_clear(self, api_client, test_channel_id):
        """PATCH /api/channels/{id}/project-name can clear project name"""
        response = api_client.patch(
            f"{BASE_URL}/api/channels/{test_channel_id}/project-name",
            json={"project_name": None}
        )
        
        assert response.status_code == 200, f"Project name clear failed: {response.text}"
        data = response.json()
        assert data.get("success") is True
        print("✓ PATCH /api/channels/{id}/project-name - clears project name with null")


# ==================== VALIDATION TESTS ====================

class TestValidation:
    """Test validation and error handling"""
    
    def test_project_name_update_404_for_nonexistent(self, api_client):
        """PATCH /api/channels/{id}/project-name returns 404 for non-existent channel"""
        response = api_client.patch(
            f"{BASE_URL}/api/channels/nonexistent_channel_id/project-name",
            json={"project_name": "Test"}
        )
        assert response.status_code == 404
        print("✓ PATCH /api/channels/{id}/project-name - returns 404 for non-existent channel")
    
    def test_autosave_requires_auth(self):
        """Autosave endpoints require authentication"""
        # Test without auth
        response = requests.get(f"{BASE_URL}/api/search-results/autosave")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Autosave endpoints require authentication")
    
    def test_pipeline_projects_requires_auth(self):
        """Pipeline projects endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/pipeline/projects")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Pipeline projects endpoint requires authentication")


# ==================== INTEGRATION TESTS ====================

class TestIntegration:
    """Integration tests for full workflows"""
    
    def test_autosave_upsert_behavior(self, api_client):
        """Autosave should upsert (update existing record)"""
        # First save
        api_client.post(f"{BASE_URL}/api/search-results/autosave", json={
            "channels": [{"channel_id": "ch1", "channel_name": "First"}],
            "search_metadata": {"version": 1}
        })
        
        # Second save (should update, not create new)
        api_client.post(f"{BASE_URL}/api/search-results/autosave", json={
            "channels": [{"channel_id": "ch2", "channel_name": "Second"}],
            "search_metadata": {"version": 2}
        })
        
        # Get should return latest
        response = api_client.get(f"{BASE_URL}/api/search-results/autosave")
        assert response.status_code == 200
        data = response.json()
        assert data["search_metadata"]["version"] == 2
        assert data["channels"][0]["channel_id"] == "ch2"
        print("✓ Autosave upserts correctly (updates existing record)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/search-results/autosave")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
