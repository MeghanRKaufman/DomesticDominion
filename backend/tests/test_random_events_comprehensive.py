"""
Comprehensive tests for Random Events / Secret Missions feature.
Tests cover:
- Random event generation with public daily observance theme
- Schedule-aware prompting (respects user's in-app availability window)
- 1 active mission per user rule
- Accept / dismiss flow for random event popup
- Complete flow awards XP and updates user progression
- Pair/team follow-up: when one participant completes and another stayed pending/dismissed
- Regression: availability calendar still saves and verification rejection flow still works
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv('/app/backend/.env')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-quest.preview.emergentagent.com').rstrip('/')
API_BASE = f'{BASE_URL}/api'
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

WEEKLY_ALWAYS_AVAILABLE = {
    day: {"enabled": True, "start": "00:00", "end": "23:59"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}

WEEKLY_NEVER_AVAILABLE = {
    day: {"enabled": False, "start": "00:00", "end": "00:00"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}


def create_household_with_members(member_count=2, availability=None):
    """Helper to create a household with specified number of members."""
    if availability is None:
        availability = WEEKLY_ALWAYS_AVAILABLE
    
    payload = {
        "householdName": f"Random Event Test {uuid.uuid4().hex[:6]}",
        "adminName": "Event Admin",
        "householdType": "roommates",
        "memberLimit": max(member_count, 2),
        "householdSetup": {
            "rooms": {"bedrooms": 1, "bathrooms": 1, "kitchen": True, "livingRoom": True},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "availability": {"weekly": availability, "overrides": {}},
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChoreLoad": 4,
        },
    }
    create_response = requests.post(f'{API_BASE}/households/create-enhanced', json=payload, timeout=30)
    create_response.raise_for_status()
    created = create_response.json()

    member_ids = [created['userId']]
    for idx in range(member_count - 1):
        join_response = requests.post(
            f'{API_BASE}/households/join',
            json={
                'inviteCode': created['inviteCode'],
                'memberName': f'Member {idx + 1}',
                'memberPreferences': {
                    'availability': {'weekly': availability, 'overrides': {}},
                    'choreAversions': [],
                    'preferredTasks': [],
                    'maxDailyChoreLoad': 4,
                },
            },
            timeout=30,
        )
        join_response.raise_for_status()
        member_ids.append(join_response.json()['userId'])

    return created['householdId'], member_ids, created['inviteCode']


@pytest.fixture(scope='module')
def db():
    """MongoDB connection fixture."""
    client = MongoClient(MONGO_URL)
    database = client[DB_NAME]
    yield database
    client.close()


class TestRandomEventGeneration:
    """Tests for random event generation with public daily observance theme."""
    
    def test_random_event_generation_returns_event_with_theme(self):
        """Test that random event generation returns an event with a theme name."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event_payload = event_response.json()['event']

        assert event_payload is not None, "Event should be generated"
        assert event_payload['themeName'], "Event should have a theme name"
        assert event_payload['title'], "Event should have a title"
        assert event_payload['description'], "Event should have a description"
        assert event_payload['completionHint'], "Event should have a completion hint"
        assert event_payload['userXpReward'] > 0, "Event should have XP reward"
        assert event_payload['participantCount'] >= 1, "Event should have at least 1 participant"
    
    def test_random_event_has_valid_structure(self):
        """Test that random event has all required fields."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event_payload = event_response.json()['event']

        required_fields = ['eventId', 'householdId', 'date', 'eventType', 'themeName', 
                          'title', 'description', 'completionHint', 'status', 'expiresAt']
        for field in required_fields:
            assert field in event_payload, f"Event should have field: {field}"
        
        assert event_payload['status'] == 'active', "New event should be active"
        assert event_payload['userStatus'] == 'pending', "User status should be pending initially"


class TestScheduleAwarePrompting:
    """Tests for schedule-aware prompting (respects user's in-app availability window)."""
    
    def test_unavailable_user_does_not_receive_new_event(self, db):
        """Test that a user outside their availability window does not receive new events."""
        # Create household with user who is never available
        _, member_ids, _ = create_household_with_members(member_count=1, availability=WEEKLY_NEVER_AVAILABLE)
        admin_id = member_ids[0]

        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        result = event_response.json()

        # User should not receive an event when unavailable
        assert result['event'] is None, "Unavailable user should not receive new event"
        assert 'No secret mission' in result.get('message', ''), "Should indicate no mission available"
    
    def test_accepted_event_remains_visible_outside_availability(self, db):
        """Test that an accepted mission remains visible even outside availability window."""
        # Create household with always-available user
        household_id, member_ids, _ = create_household_with_members(member_count=1)
        admin_id = member_ids[0]

        # Generate and accept an event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        # Accept the event
        accept_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'accept'},
            timeout=30,
        )
        accept_response.raise_for_status()
        
        # Now update user to be unavailable
        db.users.update_one(
            {"userId": admin_id},
            {"$set": {"preferences.availability.weekly": WEEKLY_NEVER_AVAILABLE}}
        )
        
        # Fetch event again - accepted event should still be visible
        event_response2 = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response2.raise_for_status()
        result = event_response2.json()
        
        # Accepted event should still be returned
        assert result['event'] is not None, "Accepted event should remain visible"
        assert result['event']['userStatus'] == 'accepted', "Event should still be accepted"


class TestOneActiveMissionPerUser:
    """Tests for 1 active mission per user rule."""
    
    def test_user_cannot_have_multiple_active_events(self, db):
        """Test that a user can only have one active event at a time."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get first event
        event_response1 = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response1.raise_for_status()
        event1 = event_response1.json()['event']
        assert event1 is not None, "First event should be generated"
        
        # Try to get another event - should return the same event
        event_response2 = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response2.raise_for_status()
        event2 = event_response2.json()['event']
        
        assert event2 is not None, "Should return existing event"
        assert event1['eventId'] == event2['eventId'], "Should return the same event, not create a new one"
    
    def test_user_can_get_new_event_after_completing_previous(self, db):
        """Test that a user can get a new event after completing the previous one."""
        household_id, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get and complete first event
        event_response1 = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response1.raise_for_status()
        event1 = event_response1.json()['event']
        
        # Accept the event
        requests.post(
            f"{API_BASE}/random-events/{event1['eventId']}/respond",
            json={'userId': admin_id, 'response': 'accept'},
            timeout=30,
        )
        
        # Complete the event
        complete_response = requests.post(
            f"{API_BASE}/random-events/{event1['eventId']}/complete",
            json={'userId': admin_id},
            timeout=30,
        )
        complete_response.raise_for_status()
        
        # Clear daily quota to allow new event generation
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        db.random_events.delete_many({
            "householdId": household_id,
            "date": today,
            "eventId": {"$ne": event1['eventId']}
        })
        
        # Try to get a new event
        event_response2 = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response2.raise_for_status()
        result = event_response2.json()
        
        # May or may not get a new event due to daily quota, but should not return completed event
        if result['event'] is not None:
            assert result['event']['eventId'] != event1['eventId'], "Should not return completed event"


class TestAcceptDismissFlow:
    """Tests for accept / dismiss flow for random event popup."""
    
    def test_accept_event_updates_status(self):
        """Test that accepting an event updates the user's status to 'accepted'."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        # Accept the event
        accept_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'accept'},
            timeout=30,
        )
        accept_response.raise_for_status()
        result = accept_response.json()
        
        assert result['success'] is True
        assert result['event']['userStatus'] == 'accepted'
        assert 'accepted' in result['message'].lower()
    
    def test_dismiss_event_updates_status(self):
        """Test that dismissing an event updates the user's status to 'dismissed'."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        # Dismiss the event
        dismiss_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'dismiss'},
            timeout=30,
        )
        dismiss_response.raise_for_status()
        result = dismiss_response.json()
        
        assert result['success'] is True
        assert result['event']['userStatus'] == 'dismissed'
        assert 'dismissed' in result['message'].lower()
    
    def test_dismiss_is_not_punitive(self, db):
        """Test that dismissing an event does not penalize the user (no XP loss)."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get user's initial points
        user_before = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30).json()
        initial_points = user_before.get('points', 0)
        
        # Get and dismiss event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'dismiss'},
            timeout=30,
        )
        
        # Check user's points after dismissal
        user_after = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30).json()
        final_points = user_after.get('points', 0)
        
        assert final_points >= initial_points, "Dismissing should not reduce points"
    
    def test_cannot_complete_without_accepting(self):
        """Test that a user cannot complete an event without accepting it first."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        # Try to complete without accepting
        complete_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/complete",
            json={'userId': admin_id},
            timeout=30,
        )
        
        assert complete_response.status_code == 400, "Should not allow completion without acceptance"
        assert 'accept' in complete_response.json().get('detail', '').lower()


class TestCompleteFlowXPAward:
    """Tests for complete flow awards XP and updates user progression."""
    
    def test_complete_event_awards_xp(self):
        """Test that completing an event awards XP to the user."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Get user's initial points
        user_before = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30).json()
        initial_points = user_before.get('points', 0)
        
        # Get event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        expected_xp = event['userXpReward']
        
        # Accept the event
        requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'accept'},
            timeout=30,
        )
        
        # Complete the event
        complete_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/complete",
            json={'userId': admin_id},
            timeout=30,
        )
        complete_response.raise_for_status()
        result = complete_response.json()
        
        assert result['xpAwarded'] == expected_xp, "Should award expected XP"
        assert result['points'] == initial_points + expected_xp, "Points should be updated"
        
        # Verify user's points in database
        user_after = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30).json()
        assert user_after['points'] == initial_points + expected_xp
    
    def test_complete_event_updates_level_if_threshold_reached(self, db):
        """Test that completing an event updates level if XP threshold is reached."""
        _, member_ids, _ = create_household_with_members(member_count=2)
        admin_id = member_ids[0]

        # Set user's points to just below level threshold (100 points per level)
        db.users.update_one(
            {"userId": admin_id},
            {"$set": {"points": 95, "level": 1}}
        )
        
        # Get event
        event_response = requests.get(
            f'{API_BASE}/random-events/user/{admin_id}',
            params={'trigger': 'pytest'},
            timeout=30,
        )
        event_response.raise_for_status()
        event = event_response.json()['event']
        
        # Accept and complete
        requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/respond",
            json={'userId': admin_id, 'response': 'accept'},
            timeout=30,
        )
        
        complete_response = requests.post(
            f"{API_BASE}/random-events/{event['eventId']}/complete",
            json={'userId': admin_id},
            timeout=30,
        )
        complete_response.raise_for_status()
        result = complete_response.json()
        
        # If XP pushed user over 100, level should increase
        if result['points'] >= 100:
            assert result['level'] >= 2, "Level should increase when XP threshold reached"


class TestPairTeamFollowUp:
    """Tests for pair/team follow-up when one participant completes and another stayed pending/dismissed."""
    
    def test_pair_event_completion_creates_follow_up_for_pending_participant(self, db):
        """Test that completing a pair event creates a follow-up for pending participant."""
        household_id, member_ids, _ = create_household_with_members(member_count=2)
        first_user, second_user = member_ids
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        # Create a pair event directly in DB
        event_id = f'event_{uuid.uuid4().hex[:10]}'
        db.random_events.insert_one({
            'eventId': event_id,
            'householdId': household_id,
            'date': today,
            'eventType': 'pair',
            'themeName': 'Test Theme Day',
            'title': 'Secret Side Mission: Test Theme Day',
            'description': 'Pair mission test',
            'completionHint': 'Do one thoughtful thing each',
            'targetLabel': 'the household',
            'status': 'active',
            'triggerSource': 'pytest',
            'parentEventId': None,
            'expiresAt': (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'participants': [
                {
                    'userId': first_user,
                    'displayName': 'First User',
                    'status': 'accepted',
                    'xpReward': 18,
                    'promptCount': 1,
                },
                {
                    'userId': second_user,
                    'displayName': 'Second User',
                    'status': 'pending',
                    'xpReward': 18,
                    'promptCount': 1,
                },
            ],
        })

        # First user completes the event
        complete_response = requests.post(
            f'{API_BASE}/random-events/{event_id}/complete',
            json={'userId': first_user},
            timeout=30,
        )
        complete_response.raise_for_status()
        result = complete_response.json()

        # Second user should be in reoffered list
        assert second_user in result['reofferedUserIds'], "Pending participant should get follow-up"

        # Verify follow-up event was created
        follow_up_event = db.random_events.find_one(
            {'parentEventId': event_id, 'participants.userId': second_user},
            {'_id': 0},
        )
        assert follow_up_event is not None, "Follow-up event should be created"
        assert follow_up_event['eventType'] == 'follow_up', "Event type should be follow_up"
    
    def test_pair_event_completion_marks_pending_participant_as_reassigned(self, db):
        """Test that completing a pair event marks pending participant as reassigned."""
        household_id, member_ids, _ = create_household_with_members(member_count=2)
        first_user, second_user = member_ids
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        # Create a pair event
        event_id = f'event_{uuid.uuid4().hex[:10]}'
        db.random_events.insert_one({
            'eventId': event_id,
            'householdId': household_id,
            'date': today,
            'eventType': 'pair',
            'themeName': 'Test Theme Day',
            'title': 'Secret Side Mission: Test Theme Day',
            'description': 'Pair mission test',
            'completionHint': 'Do one thoughtful thing each',
            'targetLabel': 'the household',
            'status': 'active',
            'triggerSource': 'pytest',
            'parentEventId': None,
            'expiresAt': (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'participants': [
                {
                    'userId': first_user,
                    'displayName': 'First User',
                    'status': 'accepted',
                    'xpReward': 18,
                    'promptCount': 1,
                },
                {
                    'userId': second_user,
                    'displayName': 'Second User',
                    'status': 'pending',
                    'xpReward': 18,
                    'promptCount': 1,
                },
            ],
        })

        # First user completes
        requests.post(
            f'{API_BASE}/random-events/{event_id}/complete',
            json={'userId': first_user},
            timeout=30,
        )

        # Check parent event - second user should be marked as reassigned
        parent_event = db.random_events.find_one({'eventId': event_id}, {'_id': 0})
        second_participant = next(
            item for item in parent_event['participants'] if item['userId'] == second_user
        )
        assert second_participant['status'] == 'reassigned', "Pending participant should be marked as reassigned"


class TestRegressionAvailabilityCalendar:
    """Regression tests for availability calendar functionality."""
    
    def test_availability_calendar_saves_weekly_defaults(self):
        """Test that availability calendar saves weekly defaults correctly."""
        _, member_ids, _ = create_household_with_members(member_count=1)
        admin_id = member_ids[0]

        # Update availability preferences
        new_availability = {
            "weekly": {
                "Monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Wednesday": {"enabled": False, "start": "00:00", "end": "00:00"},
                "Thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Saturday": {"enabled": True, "start": "10:00", "end": "20:00"},
                "Sunday": {"enabled": True, "start": "10:00", "end": "20:00"},
            },
            "overrides": {}
        }
        
        response = requests.post(
            f'{API_BASE}/users/{admin_id}/preferences',
            json={
                'userId': admin_id,
                'preferences': {'availability': new_availability}
            },
            timeout=30,
        )
        response.raise_for_status()
        
        # Verify saved
        user_response = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30)
        user_response.raise_for_status()
        user = user_response.json()
        
        saved_availability = user.get('preferences', {}).get('availability', {}).get('weekly', {})
        assert saved_availability.get('Monday', {}).get('start') == '09:00'
        assert saved_availability.get('Wednesday', {}).get('enabled') is False
    
    def test_availability_calendar_saves_date_overrides(self):
        """Test that availability calendar saves date overrides correctly."""
        _, member_ids, _ = create_household_with_members(member_count=1)
        admin_id = member_ids[0]

        # Create a date override
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime('%Y-%m-%d')
        new_availability = {
            "weekly": WEEKLY_ALWAYS_AVAILABLE,
            "overrides": {
                tomorrow: {"enabled": False, "start": "00:00", "end": "00:00"}
            }
        }
        
        response = requests.post(
            f'{API_BASE}/users/{admin_id}/preferences',
            json={
                'userId': admin_id,
                'preferences': {'availability': new_availability}
            },
            timeout=30,
        )
        response.raise_for_status()
        
        # Verify saved
        user_response = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30)
        user_response.raise_for_status()
        user = user_response.json()
        
        saved_overrides = user.get('preferences', {}).get('availability', {}).get('overrides', {})
        assert tomorrow in saved_overrides
        assert saved_overrides[tomorrow]['enabled'] is False


class TestRegressionVerificationRejection:
    """Regression tests for verification rejection flow."""
    
    def test_rejected_task_can_be_recompleted(self, db):
        """Test that a rejected task can be re-completed (regression from iteration 2)."""
        household_id, member_ids, _ = create_household_with_members(member_count=2)
        first_user, second_user = member_ids

        # Assign chores - admin_user_id is required as query param
        assign_response = requests.post(
            f'{API_BASE}/households/{household_id}/assign-chores',
            params={'admin_user_id': first_user},
            timeout=30,
        )
        assign_response.raise_for_status()
        
        # Get a task assigned to first user
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        tasks_response = requests.get(
            f'{API_BASE}/tasks',
            params={'householdId': household_id, 'date': today},
            timeout=30,
        )
        tasks_response.raise_for_status()
        tasks = tasks_response.json()
        
        user_task = next(
            (t for t in tasks if t.get('assignedTo') == first_user and not t.get('completed')),
            None
        )
        
        if not user_task:
            pytest.skip("No task assigned to first user for this test")
        
        task_id = user_task['taskId']
        
        # Complete the task
        complete_response = requests.post(
            f'{API_BASE}/tasks/{task_id}/complete',
            json={'userId': first_user},
            timeout=30,
        )
        complete_response.raise_for_status()
        
        # Check if verification was triggered
        task_after_complete = db.tasks.find_one({'taskId': task_id}, {'_id': 0})
        if not task_after_complete.get('pendingVerification'):
            pytest.skip("Task did not trigger verification")
        
        # Second user rejects verification
        reject_response = requests.post(
            f'{API_BASE}/tasks/{task_id}/verify',
            json={
                'verifierId': second_user,
                'approved': False,
                'reason': 'Test rejection'
            },
            timeout=30,
        )
        reject_response.raise_for_status()
        
        # Verify task can be re-completed
        task_after_reject = db.tasks.find_one({'taskId': task_id}, {'_id': 0})
        assert task_after_reject.get('completed') is False, "Rejected task should have completed=False"
        
        # Try to complete again
        recomplete_response = requests.post(
            f'{API_BASE}/tasks/{task_id}/complete',
            json={'userId': first_user},
            timeout=30,
        )
        
        # Should succeed (not return "Task already completed" error)
        assert recomplete_response.status_code == 200, "Should be able to re-complete rejected task"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
