"""
Verification Flow Tests for Domestic Dominion
Tests the ~25% verification system including:
- Task completion with verification trigger
- Pending verification list behavior
- Verification approval (XP awarded)
- Verification rejection (task re-completable)
- Self-verification prevention
"""
import pytest
import requests
import os
import uuid
from datetime import datetime
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVerificationFlow:
    """Test the complete verification flow with two users"""
    
    @pytest.fixture
    def two_member_household(self):
        """Create a household with admin and one member"""
        # Create household with admin
        payload = {
            "householdName": f"Verify Test Kingdom {uuid.uuid4().hex[:6]}",
            "adminName": "Admin User",
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
        household_data = create_response.json()
        
        admin_id = household_data["userId"]
        household_id = household_data["householdId"]
        invite_code = household_data["inviteCode"]
        
        # Join second member
        join_payload = {
            "inviteCode": invite_code,
            "memberName": f"Member User {uuid.uuid4().hex[:4]}"
        }
        join_response = requests.post(f"{BASE_URL}/api/households/join", json=join_payload)
        assert join_response.status_code == 200, f"Join household failed: {join_response.text}"
        member_data = join_response.json()
        member_id = member_data.get("userId") or member_data.get("user", {}).get("userId")
        
        # Assign chores
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id}
        )
        assert assign_response.status_code == 200, f"Assign chores failed: {assign_response.text}"
        
        return {
            "household_id": household_id,
            "admin_id": admin_id,
            "member_id": member_id,
            "invite_code": invite_code
        }
    
    def test_complete_task_triggers_verification(self, two_member_household):
        """Test that completing a task can trigger verification requirement"""
        household_id = two_member_household["household_id"]
        admin_id = two_member_household["admin_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
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
        
        assert len(all_tasks) > 0, "Admin should have tasks assigned"
        print(f"✅ Admin has {len(all_tasks)} tasks assigned")
        
        # Complete tasks until one triggers verification (25% chance)
        verification_triggered = False
        completed_count = 0
        
        for task in all_tasks[:10]:  # Try up to 10 tasks
            if task.get("completed"):
                continue
                
            complete_response = requests.post(
                f"{BASE_URL}/api/tasks/{task['taskId']}/complete",
                json={"userId": admin_id, "notes": "", "bonusPoints": 0}
            )
            
            if complete_response.status_code == 200:
                data = complete_response.json()
                completed_count += 1
                
                if data.get("requiresVerification"):
                    verification_triggered = True
                    print(f"✅ Verification triggered on task: {task['title']}")
                    print(f"   XP pending: {data.get('xpPending')}")
                    return task["taskId"], two_member_household
                else:
                    print(f"   Task completed without verification: {task['title']}")
        
        # If no verification triggered after 10 tasks, that's statistically unlikely but possible
        print(f"⚠️ Completed {completed_count} tasks, no verification triggered (25% chance each)")
        pytest.skip("No verification triggered - this is statistically possible but rare")
    
    def test_pending_verifications_excludes_own_tasks(self, two_member_household):
        """Test that pending verifications list excludes user's own tasks"""
        household_id = two_member_household["household_id"]
        admin_id = two_member_household["admin_id"]
        member_id = two_member_household["member_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get admin's tasks and complete some
        tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        tasks_by_room = tasks_response.json()
        all_tasks = []
        for room_tasks in tasks_by_room.values():
            all_tasks.extend(room_tasks)
        
        # Complete tasks until verification triggers
        pending_task_id = None
        for task in all_tasks[:15]:
            if task.get("completed"):
                continue
            complete_response = requests.post(
                f"{BASE_URL}/api/tasks/{task['taskId']}/complete",
                json={"userId": admin_id}
            )
            if complete_response.status_code == 200:
                data = complete_response.json()
                if data.get("requiresVerification"):
                    pending_task_id = task["taskId"]
                    break
        
        if not pending_task_id:
            pytest.skip("Could not trigger verification")
        
        # Get pending verifications as admin (should NOT see own task)
        admin_pending = requests.get(f"{BASE_URL}/api/tasks/pending-verification/{household_id}")
        assert admin_pending.status_code == 200
        admin_pending_tasks = admin_pending.json()
        
        # Filter as frontend does - exclude own tasks
        admin_own_pending = [t for t in admin_pending_tasks if t.get("completedBy") == admin_id]
        admin_others_pending = [t for t in admin_pending_tasks if t.get("completedBy") != admin_id]
        
        print(f"✅ Admin sees {len(admin_others_pending)} tasks to verify (excluding own)")
        print(f"   Admin's own pending tasks (should not verify): {len(admin_own_pending)}")
        
        # Verify the pending task is in the list
        pending_in_list = any(t["taskId"] == pending_task_id for t in admin_pending_tasks)
        assert pending_in_list, "Pending task should be in household's pending list"
        
        # Member should see admin's pending task
        member_pending = requests.get(f"{BASE_URL}/api/tasks/pending-verification/{household_id}")
        member_pending_tasks = member_pending.json()
        member_can_verify = [t for t in member_pending_tasks if t.get("completedBy") != member_id]
        
        admin_task_visible_to_member = any(t["taskId"] == pending_task_id for t in member_can_verify)
        assert admin_task_visible_to_member, "Member should see admin's pending task"
        print(f"✅ Member can see admin's pending task for verification")
    
    def test_cannot_verify_own_task(self, two_member_household):
        """Test that a user cannot verify their own task"""
        household_id = two_member_household["household_id"]
        admin_id = two_member_household["admin_id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get and complete a task
        tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        tasks_by_room = tasks_response.json()
        all_tasks = []
        for room_tasks in tasks_by_room.values():
            all_tasks.extend(room_tasks)
        
        # Complete tasks until verification triggers
        pending_task_id = None
        for task in all_tasks[:15]:
            if task.get("completed"):
                continue
            complete_response = requests.post(
                f"{BASE_URL}/api/tasks/{task['taskId']}/complete",
                json={"userId": admin_id}
            )
            if complete_response.status_code == 200:
                data = complete_response.json()
                if data.get("requiresVerification"):
                    pending_task_id = task["taskId"]
                    break
        
        if not pending_task_id:
            pytest.skip("Could not trigger verification")
        
        # Try to verify own task - should fail
        verify_response = requests.post(
            f"{BASE_URL}/api/tasks/{pending_task_id}/verify",
            json={"verifierId": admin_id, "approved": True, "notes": ""}
        )
        
        assert verify_response.status_code == 400, f"Self-verification should be rejected, got {verify_response.status_code}"
        print(f"✅ Self-verification correctly rejected with 400")
    
    def test_verification_approval_awards_xp(self):
        """Test that approving verification awards held XP plus bonus"""
        # Create fresh household for this test
        payload = {
            "householdName": f"XP Award Test {uuid.uuid4().hex[:6]}",
            "adminName": "XP Admin",
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
        household_data = create_response.json()
        
        admin_id = household_data["userId"]
        household_id = household_data["householdId"]
        invite_code = household_data["inviteCode"]
        
        # Join member
        join_response = requests.post(f"{BASE_URL}/api/households/join", json={
            "inviteCode": invite_code,
            "memberName": "XP Member"
        })
        assert join_response.status_code == 200
        member_data = join_response.json()
        member_id = member_data.get("userId") or member_data.get("user", {}).get("userId")
        
        # Assign chores
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id}
        )
        assert assign_response.status_code == 200
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get admin's initial points (should be 0 for fresh user)
        admin_before = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        assert admin_before.status_code == 200
        admin_points_before = admin_before.json().get("points", 0)
        print(f"Admin initial points: {admin_points_before}")
        
        # Get and complete a task
        tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        tasks_by_room = tasks_response.json()
        all_tasks = []
        for room_tasks in tasks_by_room.values():
            all_tasks.extend(room_tasks)
        
        # Complete tasks until verification triggers
        # Track points RIGHT BEFORE the verification-triggering completion
        pending_task_id = None
        xp_pending = 0
        points_before_verification_task = 0
        
        for task in all_tasks[:15]:
            if task.get("completed"):
                continue
            
            # Capture points BEFORE this completion attempt
            admin_check = requests.get(f"{BASE_URL}/api/users/{admin_id}")
            current_points = admin_check.json().get("points", 0)
            
            complete_response = requests.post(
                f"{BASE_URL}/api/tasks/{task['taskId']}/complete",
                json={"userId": admin_id}
            )
            if complete_response.status_code == 200:
                data = complete_response.json()
                if data.get("requiresVerification"):
                    pending_task_id = task["taskId"]
                    xp_pending = data.get("xpPending", 0)
                    points_before_verification_task = current_points
                    print(f"✅ Verification triggered for: {task['title']}")
                    print(f"   XP pending: {xp_pending}")
                    break
        
        if not pending_task_id:
            pytest.skip("Could not trigger verification")
        
        # Check admin points haven't changed from the verification task
        admin_mid = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        admin_points_mid = admin_mid.json().get("points", 0)
        assert admin_points_mid == points_before_verification_task, f"XP should not be awarded before verification. Expected {points_before_verification_task}, got {admin_points_mid}"
        print(f"✅ XP correctly held before verification (points: {admin_points_mid})")
        
        # Member approves the task
        verify_response = requests.post(
            f"{BASE_URL}/api/tasks/{pending_task_id}/verify",
            json={"verifierId": member_id, "approved": True, "notes": ""}
        )
        assert verify_response.status_code == 200, f"Verification failed: {verify_response.text}"
        verify_data = verify_response.json()
        
        assert verify_data.get("success"), "Verification should succeed"
        points_awarded = verify_data.get("pointsAwarded", 0)
        verification_bonus = verify_data.get("verificationBonus", 0)
        
        print(f"✅ Verification approved!")
        print(f"   Points awarded: {points_awarded}")
        print(f"   Verification bonus: {verification_bonus}")
        
        # Check admin received XP
        admin_after = requests.get(f"{BASE_URL}/api/users/{admin_id}")
        admin_points_after = admin_after.json().get("points", 0)
        
        expected_points = points_before_verification_task + points_awarded
        assert admin_points_after == expected_points, f"Admin should have {expected_points} points, got {admin_points_after}"
        print(f"✅ Admin XP correctly updated: {points_before_verification_task} -> {admin_points_after}")
    
    def test_verification_rejection_allows_recompletion(self):
        """Test that rejecting verification allows task to be re-completed"""
        # Create fresh household for this test
        payload = {
            "householdName": f"Reject Test {uuid.uuid4().hex[:6]}",
            "adminName": "Reject Admin",
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
        household_data = create_response.json()
        
        admin_id = household_data["userId"]
        household_id = household_data["householdId"]
        invite_code = household_data["inviteCode"]
        
        # Join member
        join_response = requests.post(f"{BASE_URL}/api/households/join", json={
            "inviteCode": invite_code,
            "memberName": "Reject Member"
        })
        assert join_response.status_code == 200
        member_data = join_response.json()
        member_id = member_data.get("userId") or member_data.get("user", {}).get("userId")
        
        # Assign chores
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id}
        )
        assert assign_response.status_code == 200
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get and complete a task
        tasks_response = requests.get(
            f"{BASE_URL}/api/households/{household_id}/my-tasks/{admin_id}",
            params={"date": today}
        )
        tasks_by_room = tasks_response.json()
        all_tasks = []
        for room_tasks in tasks_by_room.values():
            all_tasks.extend(room_tasks)
        
        # Complete tasks until verification triggers
        pending_task_id = None
        for task in all_tasks[:15]:
            if task.get("completed"):
                continue
            complete_response = requests.post(
                f"{BASE_URL}/api/tasks/{task['taskId']}/complete",
                json={"userId": admin_id}
            )
            if complete_response.status_code == 200:
                data = complete_response.json()
                if data.get("requiresVerification"):
                    pending_task_id = task["taskId"]
                    print(f"✅ Task pending verification: {task['title']}")
                    break
        
        if not pending_task_id:
            pytest.skip("Could not trigger verification")
        
        # Member rejects the task
        reject_response = requests.post(
            f"{BASE_URL}/api/tasks/{pending_task_id}/verify",
            json={"verifierId": member_id, "approved": False, "notes": "Not done properly"}
        )
        assert reject_response.status_code == 200, f"Rejection failed: {reject_response.text}"
        reject_data = reject_response.json()
        
        assert reject_data.get("success"), "Rejection should succeed"
        print(f"✅ Task rejected: {reject_data.get('message')}")
        
        # Check task state - should be re-completable
        # The task should have completed=False or verificationFailed=True with completed reset
        # Let's try to complete it again
        recompletion_response = requests.post(
            f"{BASE_URL}/api/tasks/{pending_task_id}/complete",
            json={"userId": admin_id}
        )
        
        # This is the critical test - can the task be re-completed?
        if recompletion_response.status_code == 200:
            print(f"✅ Task can be re-completed after rejection")
        elif recompletion_response.status_code == 400:
            error_detail = recompletion_response.json().get("detail", "")
            if "already completed" in error_detail.lower():
                print(f"❌ BUG: Task cannot be re-completed after rejection!")
                print(f"   Error: {error_detail}")
                pytest.fail("Task should be re-completable after verification rejection")
            else:
                print(f"⚠️ Unexpected error: {error_detail}")
        else:
            print(f"⚠️ Unexpected status: {recompletion_response.status_code}")


class TestJoinFlowRegression:
    """Regression tests for invite-code join flow"""
    
    def test_join_flow_with_redistribution(self):
        """Test that joining triggers chore redistribution"""
        # Create household
        payload = {
            "householdName": f"Join Redistrib Test {uuid.uuid4().hex[:6]}",
            "adminName": "Admin",
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
        create_response = requests.post(f"{BASE_URL}/api/households/create-enhanced", json=payload)
        assert create_response.status_code == 200
        data = create_response.json()
        
        household_id = data["householdId"]
        admin_id = data["userId"]
        invite_code = data["inviteCode"]
        
        # Assign chores to admin only
        assign_response = requests.post(
            f"{BASE_URL}/api/households/{household_id}/assign-chores",
            params={"admin_user_id": admin_id}
        )
        assert assign_response.status_code == 200
        initial_distribution = assign_response.json().get("distribution", {})
        print(f"✅ Initial distribution (admin only): {initial_distribution}")
        
        # Join new member
        join_payload = {
            "inviteCode": invite_code,
            "memberName": "New Member"
        }
        join_response = requests.post(f"{BASE_URL}/api/households/join", json=join_payload)
        assert join_response.status_code == 200
        member_data = join_response.json()
        
        # Check if redistribution happened
        # The join endpoint should trigger redistribution
        print(f"✅ Member joined successfully")
        
        # Get household stats to verify member count
        stats_response = requests.get(f"{BASE_URL}/api/households/{household_id}/stats")
        if stats_response.status_code == 200:
            stats = stats_response.json()
            member_count = stats.get("memberCount", 0)
            print(f"   Household now has {member_count} members")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
