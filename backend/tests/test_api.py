"""
Backend API Tests for Domestic Dominion
Tests household creation, chore assignment, join flow, and talent tree endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test that the API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Health check passed")


class TestHouseholdCreation:
    """Test household creation via enhanced endpoint"""
    
    def test_create_household_enhanced(self):
        """Test POST /api/households/create-enhanced"""
        payload = {
            "householdName": f"Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Test Admin",
            "householdType": "roommates",  # lowercase as per fix
            "householdSize": 3,
            "bedroomSetup": "shared",
            "rooms": {
                "bedrooms": 2,
                "bathrooms": 1,
                "hasBasement": False,
                "hasAttic": False,
                "hasGarage": False,
                "hasOffice": False
            },
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday", "Thursday"],
            "pets": [],
            "vehicles": [],
            "weekdayAvailability": {
                "start": "06:00 PM",
                "end": "10:00 PM"
            },
            "weekendAvailability": {
                "start": "08:00 AM",
                "end": "08:00 PM"
            },
            "lowEnergyDays": [],
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChores": 3
        }
        
        response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert response.status_code == 200, f"Create household failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "household" in data, "Response missing 'household' key"
        assert "user" in data, "Response missing 'user' key"
        assert "chores" in data, "Response missing 'chores' key"
        
        household = data["household"]
        assert "householdId" in household, "Household missing 'householdId'"
        assert "inviteCode" in household, "Household missing 'inviteCode'"
        
        user = data["user"]
        assert "userId" in user, "User missing 'userId'"
        assert user["displayName"] == "Test Admin", f"User name mismatch: {user['displayName']}"
        
        print(f"✅ Household created: {household['householdId']}")
        print(f"   Invite code: {household['inviteCode']}")
        print(f"   Admin user: {user['userId']}")
        print(f"   Chores generated: {len(data['chores'])}")
        
        return data


class TestChoreAssignment:
    """Test chore assignment functionality"""
    
    @pytest.fixture
    def household_data(self):
        """Create a household for testing"""
        payload = {
            "householdName": f"Chore Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Chore Admin",
            "householdType": "roommates",
            "householdSize": 2,
            "bedroomSetup": "shared",
            "rooms": {"bedrooms": 1, "bathrooms": 1},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "weekdayAvailability": {"start": "06:00 PM", "end": "10:00 PM"},
            "weekendAvailability": {"start": "08:00 AM", "end": "08:00 PM"},
            "lowEnergyDays": [],
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChores": 3
        }
        response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert response.status_code == 200
        return response.json()
    
    def test_assign_chores(self, household_data):
        """Test POST /api/households/{household_id}/assign-chores"""
        household_id = household_data["household"]["householdId"]
        admin_user_id = household_data["user"]["userId"]
        
        response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_user_id}
        )
        
        assert response.status_code == 200, f"Assign chores failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "message" in data, "Response missing 'message'"
        assert "assigned_count" in data, "Response missing 'assigned_count'"
        
        print(f"✅ Chores assigned: {data['assigned_count']}")
        print(f"   Message: {data['message']}")
        
        return household_id, admin_user_id


class TestMyTasks:
    """Test user-specific task retrieval"""
    
    @pytest.fixture
    def assigned_household(self):
        """Create household and assign chores"""
        # Create household
        payload = {
            "householdName": f"Tasks Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Tasks Admin",
            "householdType": "roommates",
            "householdSize": 2,
            "bedroomSetup": "shared",
            "rooms": {"bedrooms": 1, "bathrooms": 1},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "weekdayAvailability": {"start": "06:00 PM", "end": "10:00 PM"},
            "weekendAvailability": {"start": "08:00 AM", "end": "08:00 PM"},
            "lowEnergyDays": [],
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChores": 3
        }
        create_response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert create_response.status_code == 200
        data = create_response.json()
        
        household_id = data["household"]["householdId"]
        user_id = data["user"]["userId"]
        
        # Assign chores
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": user_id}
        )
        assert assign_response.status_code == 200
        
        return {"household_id": household_id, "user_id": user_id}
    
    def test_get_my_tasks(self, assigned_household):
        """Test GET /api/households/{household_id}/my-tasks/{user_id}"""
        household_id = assigned_household["household_id"]
        user_id = assigned_household["user_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{user_id}",
            params={"date": today}
        )
        
        assert response.status_code == 200, f"Get my tasks failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "tasks_by_room" in data, "Response missing 'tasks_by_room'"
        assert "total_tasks" in data, "Response missing 'total_tasks'"
        
        print(f"✅ My tasks retrieved: {data['total_tasks']} total")
        print(f"   Rooms with tasks: {list(data['tasks_by_room'].keys())}")


class TestJoinHousehold:
    """Test household join flow via invite code"""
    
    @pytest.fixture
    def household_with_invite(self):
        """Create a household to join"""
        payload = {
            "householdName": f"Join Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Join Admin",
            "householdType": "roommates",
            "householdSize": 3,
            "bedroomSetup": "shared",
            "rooms": {"bedrooms": 2, "bathrooms": 1},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "weekdayAvailability": {"start": "06:00 PM", "end": "10:00 PM"},
            "weekendAvailability": {"start": "08:00 AM", "end": "08:00 PM"},
            "lowEnergyDays": [],
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChores": 3
        }
        response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert response.status_code == 200
        data = response.json()
        return {
            "household_id": data["household"]["householdId"],
            "invite_code": data["household"]["inviteCode"]
        }
    
    def test_join_household(self, household_with_invite):
        """Test POST /api/households/join"""
        invite_code = household_with_invite["invite_code"]
        
        payload = {
            "inviteCode": invite_code,
            "displayName": f"New Member {uuid.uuid4().hex[:4]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/households/join", json=payload)
        assert response.status_code == 200, f"Join household failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "user" in data, "Response missing 'user'"
        assert "household" in data, "Response missing 'household'"
        
        user = data["user"]
        assert "userId" in user, "User missing 'userId'"
        assert user["displayName"] == payload["displayName"], "User name mismatch"
        
        print(f"✅ Joined household successfully")
        print(f"   New user ID: {user['userId']}")
        print(f"   Household: {data['household']['householdId']}")
    
    def test_join_invalid_code(self):
        """Test joining with invalid invite code"""
        payload = {
            "inviteCode": "INVALID123",
            "displayName": "Test User"
        }
        
        response = requests.post(f"{BASE_URL}/api/households/join", json=payload)
        assert response.status_code == 404, f"Expected 404 for invalid code, got {response.status_code}"
        print("✅ Invalid invite code correctly rejected")


class TestTalentTree:
    """Test talent tree endpoints"""
    
    def test_get_talent_tree(self):
        """Test GET /api/talents/tree"""
        response = requests.get(f"{BASE_URL}/api/talents/tree")
        assert response.status_code == 200, f"Get talent tree failed: {response.status_code} - {response.text}"
        
        data = response.json()
        # Check for expected talent tree structure
        assert isinstance(data, dict), "Talent tree should be a dictionary"
        
        print(f"✅ Talent tree retrieved")
        print(f"   Specs/branches: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
    
    def test_get_user_talents(self):
        """Test GET /api/talents/user/{user_id}"""
        # First create a user
        payload = {
            "householdName": f"Talent Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Talent Admin",
            "householdType": "roommates",
            "householdSize": 2,
            "bedroomSetup": "shared",
            "rooms": {"bedrooms": 1, "bathrooms": 1},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "weekdayAvailability": {"start": "06:00 PM", "end": "10:00 PM"},
            "weekendAvailability": {"start": "08:00 AM", "end": "08:00 PM"},
            "lowEnergyDays": [],
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChores": 3
        }
        create_response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert create_response.status_code == 200
        user_id = create_response.json()["user"]["userId"]
        
        # Get user talents
        response = requests.get(f"{BASE_URL}/api/talents/user/{user_id}")
        assert response.status_code == 200, f"Get user talents failed: {response.status_code} - {response.text}"
        
        data = response.json()
        print(f"✅ User talents retrieved for {user_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
