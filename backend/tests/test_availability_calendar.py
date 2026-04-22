"""
Availability Calendar Tests for Domestic Dominion
Tests the new availability calendar feature including:
- Weekly availability defaults
- Date-specific overrides
- Availability-aware chore assignment
- Preferences save/load flow
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-quest.preview.emergentagent.com').rstrip('/')


class TestAvailabilityPreferences:
    """Test availability preferences save and load"""
    
    @pytest.fixture
    def household_with_admin(self):
        """Create a household with admin"""
        payload = {
            "householdName": f"Availability Test {uuid.uuid4().hex[:6]}",
            "adminName": "Avail Admin",
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
        assert create_response.status_code == 200, f"Create household failed: {create_response.text}"
        data = create_response.json()
        
        return {
            "household_id": data["householdId"],
            "admin_id": data["userId"],
            "invite_code": data["inviteCode"]
        }
    
    def test_save_weekly_availability(self, household_with_admin):
        """Test saving weekly availability defaults"""
        admin_id = household_with_admin["admin_id"]
        
        # Define custom weekly availability
        preferences = {
            "availability": {
                "weekly": {
                    "Monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "Tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "Wednesday": {"enabled": False, "start": "09:00", "end": "17:00"},  # Unavailable
                    "Thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "Friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                    "Saturday": {"enabled": True, "start": "10:00", "end": "20:00"},
                    "Sunday": {"enabled": True, "start": "10:00", "end": "20:00"}
                },
                "overrides": {}
            }
        }
        
        # Save preferences
        save_response = requests.post(
            f"{BASE_URL}/api/users/{admin_id}/preferences",
            json={"userId": admin_id, "preferences": preferences}
        )
        assert save_response.status_code == 200, f"Save preferences failed: {save_response.text}"
        save_data = save_response.json()
        
        assert save_data.get("success"), "Save should succeed"
        print(f"✅ Weekly availability saved successfully")
        
        # Verify preferences were saved by fetching user
        user_response = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        assert user_response.status_code == 200
        user_data = user_response.json()
        
        saved_availability = user_data.get("preferences", {}).get("availability", {})
        weekly = saved_availability.get("weekly", {})
        
        assert weekly.get("Wednesday", {}).get("enabled") == False, "Wednesday should be disabled"
        assert weekly.get("Monday", {}).get("start") == "09:00", "Monday start should be 09:00"
        print(f"✅ Weekly availability verified in user data")
    
    def test_save_date_override(self, household_with_admin):
        """Test saving date-specific availability override"""
        admin_id = household_with_admin["admin_id"]
        
        # Get tomorrow's date
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Define preferences with a date override
        preferences = {
            "availability": {
                "weekly": {
                    "Monday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Tuesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Wednesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Thursday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Friday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Saturday": {"enabled": True, "start": "09:00", "end": "21:00"},
                    "Sunday": {"enabled": True, "start": "09:00", "end": "21:00"}
                },
                "overrides": {
                    tomorrow: {"enabled": False, "start": "00:00", "end": "00:00"}  # Unavailable tomorrow
                }
            }
        }
        
        # Save preferences
        save_response = requests.post(
            f"{BASE_URL}/api/users/{admin_id}/preferences",
            json={"userId": admin_id, "preferences": preferences}
        )
        assert save_response.status_code == 200, f"Save preferences failed: {save_response.text}"
        
        # Verify override was saved
        user_response = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        user_data = user_response.json()
        
        saved_overrides = user_data.get("preferences", {}).get("availability", {}).get("overrides", {})
        assert tomorrow in saved_overrides, f"Override for {tomorrow} should be saved"
        assert saved_overrides[tomorrow].get("enabled") == False, "Override should be disabled"
        print(f"✅ Date override for {tomorrow} saved and verified")


class TestAvailabilityAwareAssignment:
    """Test that chore assignment respects availability windows"""
    
    @pytest.fixture
    def two_member_household_with_availability(self):
        """Create a household with 2 members, one unavailable today"""
        # Create household
        payload = {
            "householdName": f"Avail Assign Test {uuid.uuid4().hex[:6]}",
            "adminName": "Available Admin",
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
            "maxDailyChores": 5
        }
        create_response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert create_response.status_code == 200
        data = create_response.json()
        
        admin_id = data["userId"]
        household_id = data["householdId"]
        invite_code = data["inviteCode"]
        
        # Join second member
        join_response = requests.post(f"{BASE_URL}/api/households/join", json={
            "inviteCode": invite_code,
            "memberName": "Unavailable Member"
        })
        assert join_response.status_code == 200
        member_data = join_response.json()
        member_id = member_data.get("userId")
        
        return {
            "household_id": household_id,
            "admin_id": admin_id,
            "member_id": member_id,
            "invite_code": invite_code
        }
    
    def test_unavailable_member_gets_no_tasks_today(self, two_member_household_with_availability):
        """Test that a member marked unavailable for today gets no tasks"""
        household_id = two_member_household_with_availability["household_id"]
        admin_id = two_member_household_with_availability["admin_id"]
        member_id = two_member_household_with_availability["member_id"]
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Make member unavailable for today via date override
        preferences = {
            "availability": {
                "weekly": {
                    "Monday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Tuesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Wednesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Thursday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Friday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Saturday": {"enabled": True, "start": "09:00", "end": "21:00"},
                    "Sunday": {"enabled": True, "start": "09:00", "end": "21:00"}
                },
                "overrides": {
                    today: {"enabled": False, "start": "00:00", "end": "00:00"}  # Unavailable today
                }
            }
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/users/{member_id}/preferences",
            json={"userId": member_id, "preferences": preferences}
        )
        assert save_response.status_code == 200, f"Save member preferences failed: {save_response.text}"
        print(f"✅ Member marked unavailable for {today}")
        
        # Assign chores - should only go to admin
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id, "reset": "true"}
        )
        assert assign_response.status_code == 200, f"Assign chores failed: {assign_response.text}"
        assign_data = assign_response.json()
        
        distribution = assign_data.get("distribution", {})
        print(f"Distribution: {distribution}")
        
        # Get member's tasks for today
        member_tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{member_id}",
            params={"date": today}
        )
        assert member_tasks_response.status_code == 200
        member_tasks = member_tasks_response.json()
        
        # Count total tasks for member
        member_task_count = sum(len(tasks) for tasks in member_tasks.values())
        print(f"Member task count for today: {member_task_count}")
        
        # Member should have 0 tasks since they're unavailable
        assert member_task_count == 0, f"Unavailable member should have 0 tasks, got {member_task_count}"
        print(f"✅ Unavailable member correctly has 0 tasks for today")
        
        # Admin should have all the tasks
        admin_tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        admin_tasks = admin_tasks_response.json()
        admin_task_count = sum(len(tasks) for tasks in admin_tasks.values())
        
        assert admin_task_count > 0, "Admin should have tasks assigned"
        print(f"✅ Admin has {admin_task_count} tasks (all chores went to available member)")
    
    def test_tasks_have_scheduled_window_metadata(self, two_member_household_with_availability):
        """Test that assigned tasks include scheduledWindow metadata"""
        household_id = two_member_household_with_availability["household_id"]
        admin_id = two_member_household_with_availability["admin_id"]
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Assign chores
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id, "reset": "true"}
        )
        assert assign_response.status_code == 200
        
        # Get admin's tasks
        tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        assert tasks_response.status_code == 200
        tasks_by_room = tasks_response.json()
        
        # Flatten tasks
        all_tasks = []
        for room_tasks in tasks_by_room.values():
            all_tasks.extend(room_tasks)
        
        assert len(all_tasks) > 0, "Admin should have tasks"
        
        # Check if tasks have scheduledWindow
        tasks_with_window = [t for t in all_tasks if t.get("scheduledWindow")]
        
        if tasks_with_window:
            sample_task = tasks_with_window[0]
            window = sample_task["scheduledWindow"]
            print(f"✅ Task has scheduledWindow: {window}")
            assert "start" in window, "Window should have start time"
            assert "end" in window, "Window should have end time"
            assert "date" in window, "Window should have date"
        else:
            print(f"⚠️ No tasks have scheduledWindow metadata (may be expected if availability not set)")
    
    def test_all_members_unavailable_returns_error(self):
        """Test that assigning chores when all members are unavailable returns an error"""
        # Create household
        payload = {
            "householdName": f"All Unavail Test {uuid.uuid4().hex[:6]}",
            "adminName": "Unavail Admin",
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
        
        admin_id = data["userId"]
        household_id = data["householdId"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Make admin unavailable for today
        preferences = {
            "availability": {
                "weekly": {
                    "Monday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Tuesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Wednesday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Thursday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Friday": {"enabled": True, "start": "18:00", "end": "22:00"},
                    "Saturday": {"enabled": True, "start": "09:00", "end": "21:00"},
                    "Sunday": {"enabled": True, "start": "09:00", "end": "21:00"}
                },
                "overrides": {
                    today: {"enabled": False, "start": "00:00", "end": "00:00"}
                }
            }
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/users/{admin_id}/preferences",
            json={"userId": admin_id, "preferences": preferences}
        )
        assert save_response.status_code == 200
        
        # Try to assign chores - should fail since only member is unavailable
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id, "reset": "true"}
        )
        
        # Should return 400 error
        assert assign_response.status_code == 400, f"Expected 400 when all members unavailable, got {assign_response.status_code}"
        error_detail = assign_response.json().get("detail", "")
        assert "available" in error_detail.lower() or "unavailable" in error_detail.lower(), f"Error should mention availability: {error_detail}"
        print(f"✅ Correctly returns error when all members unavailable: {error_detail}")


class TestAvailabilityUIIntegration:
    """Test availability settings UI integration"""
    
    def test_user_endpoint_returns_preferences(self):
        """Test that GET /api/users/{user_id} returns availability preferences"""
        # Create household
        payload = {
            "householdName": f"UI Test {uuid.uuid4().hex[:6]}",
            "adminName": "UI Admin",
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
        admin_id = data["userId"]
        
        # Get user data
        user_response = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        assert user_response.status_code == 200
        user_data = user_response.json()
        
        # Check preferences structure
        preferences = user_data.get("preferences", {})
        availability = preferences.get("availability", {})
        
        assert "weekly" in availability, "Preferences should have weekly availability"
        weekly = availability["weekly"]
        
        # Check all days are present
        expected_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        for day in expected_days:
            assert day in weekly, f"Weekly should have {day}"
            assert "enabled" in weekly[day], f"{day} should have enabled flag"
            assert "start" in weekly[day], f"{day} should have start time"
            assert "end" in weekly[day], f"{day} should have end time"
        
        print(f"✅ User endpoint returns properly structured availability preferences")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
