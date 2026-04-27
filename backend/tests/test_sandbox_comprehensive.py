"""
Comprehensive Sandbox Simulator Tests for Domestic Dominion
Tests the Admin Sandbox Sim feature including:
- Sandbox household creation with multiple simulated players
- Aerial view dashboard metrics
- Player perspective switching
- Task actions (complete/refuse/miss)
- Event actions (accept/dismiss/complete)
- Schedule editing
- Notes functionality
- Mock endorsements and reward claiming
- Manual mission trigger
"""
import os
import uuid
from datetime import datetime

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-quest.preview.emergentagent.com').rstrip('/')


def create_admin_household():
    """Create a household with admin user for sandbox testing"""
    payload = {
        "householdName": f"Sandbox Source {uuid.uuid4().hex[:6]}",
        "adminName": "Sandbox Admin",
        "householdType": "roommates",
        "memberLimit": 4,
        "householdSetup": {
            "rooms": {"bedrooms": 2, "bathrooms": 1, "kitchen": True, "livingRoom": True},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "availability": {
                "weekly": {
                    day: {"enabled": True, "start": "00:00", "end": "23:59"}
                    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                },
                "overrides": {}
            },
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChoreLoad": 4,
        },
    }
    response = requests.post(f'{BASE_URL}/api/households/create-enhanced', json=payload, timeout=30)
    response.raise_for_status()
    return response.json()['userId']


class TestSandboxCreation:
    """Test sandbox household creation"""
    
    def test_create_sandbox_with_default_players(self):
        """Test creating a sandbox with default 4 players"""
        admin_id = create_admin_household()
        
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Test Kingdom Simulator',
                'playerCount': 4,
            },
            timeout=30,
        )
        assert response.status_code == 200, f"Create sandbox failed: {response.text}"
        
        sandbox = response.json()['sandbox']
        assert sandbox['householdName'] == 'Test Kingdom Simulator'
        assert sandbox['metrics']['playerCount'] == 4
        assert len(sandbox['players']) == 4
        print(f"✅ Created sandbox with 4 players")
    
    def test_create_sandbox_with_custom_player_count(self):
        """Test creating a sandbox with custom player count (2-8)"""
        admin_id = create_admin_household()
        
        for player_count in [2, 6, 8]:
            response = requests.post(
                f'{BASE_URL}/api/sandbox-households',
                json={
                    'adminUserId': admin_id,
                    'householdName': f'Kingdom with {player_count} players',
                    'playerCount': player_count,
                },
                timeout=30,
            )
            assert response.status_code == 200, f"Create sandbox with {player_count} players failed"
            sandbox = response.json()['sandbox']
            assert sandbox['metrics']['playerCount'] == player_count
            print(f"✅ Created sandbox with {player_count} players")
    
    def test_sandbox_has_tasks_assigned(self):
        """Test that sandbox has tasks assigned to players"""
        admin_id = create_admin_household()
        
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Task Test Kingdom',
                'playerCount': 3,
            },
            timeout=30,
        )
        sandbox = response.json()['sandbox']
        
        assert sandbox['metrics']['taskCount'] > 0, "Sandbox should have tasks"
        
        # Check each player has tasks
        for player in sandbox['players']:
            assert player['pendingTasks'] >= 0, f"Player {player['displayName']} should have task count"
        
        print(f"✅ Sandbox has {sandbox['metrics']['taskCount']} tasks distributed")
    
    def test_sandbox_has_endorsements(self):
        """Test that sandbox has mock endorsements/rewards"""
        admin_id = create_admin_household()
        
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Endorsement Test Kingdom',
                'playerCount': 4,
            },
            timeout=30,
        )
        sandbox = response.json()['sandbox']
        
        assert len(sandbox['endorsements']) >= 2, "Sandbox should have mock endorsements"
        
        # Check endorsement structure
        for reward in sandbox['endorsements']:
            assert 'rewardId' in reward
            assert 'businessName' in reward
            assert 'title' in reward
            assert 'rewardType' in reward
            assert reward['rewardType'] in ['coupon_drop', 'shop_offer', 'achievement_unlock']
        
        print(f"✅ Sandbox has {len(sandbox['endorsements'])} mock endorsements")


class TestAerialDashboard:
    """Test aerial view dashboard functionality"""
    
    @pytest.fixture
    def sandbox_with_players(self):
        """Create a sandbox for testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Aerial Dashboard Test',
                'playerCount': 4,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_dashboard_shows_all_players(self, sandbox_with_players):
        """Test that dashboard shows all players with their stats"""
        sandbox = sandbox_with_players
        
        for player in sandbox['players']:
            assert 'playerId' in player
            assert 'displayName' in player
            assert 'level' in player
            assert 'points' in player
            assert 'pendingTasks' in player
            assert 'refusedTasks' in player
            assert 'missedTasks' in player
            assert 'notes' in player
            assert 'events' in player
            assert 'stats' in player
        
        print(f"✅ Dashboard shows all {len(sandbox['players'])} players with complete stats")
    
    def test_dashboard_metrics_accurate(self, sandbox_with_players):
        """Test that dashboard metrics are accurate"""
        sandbox = sandbox_with_players
        metrics = sandbox['metrics']
        
        assert metrics['playerCount'] == len(sandbox['players'])
        assert metrics['taskCount'] >= 0
        assert metrics['completedTasks'] >= 0
        assert metrics['activeEvents'] >= 0
        assert metrics['availableRewards'] >= 0
        
        print(f"✅ Dashboard metrics: {metrics}")
    
    def test_player_availability_shown(self, sandbox_with_players):
        """Test that player availability status is shown"""
        sandbox = sandbox_with_players
        
        for player in sandbox['players']:
            assert 'availableNow' in player
            assert isinstance(player['availableNow'], bool)
        
        print(f"✅ Player availability status shown for all players")


class TestPlayerPerspective:
    """Test player perspective switching and actions"""
    
    @pytest.fixture
    def sandbox_with_tasks(self):
        """Create a sandbox with tasks for testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Player Perspective Test',
                'playerCount': 3,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_player_has_assigned_tasks(self, sandbox_with_tasks):
        """Test that each player has assigned tasks"""
        sandbox = sandbox_with_tasks
        
        for player in sandbox['players']:
            assert 'tasks' in player
            # At least some players should have tasks
        
        total_tasks = sum(len(p['tasks']) for p in sandbox['players'])
        assert total_tasks > 0, "Players should have tasks assigned"
        print(f"✅ Players have {total_tasks} total tasks assigned")
    
    def test_complete_task_updates_state(self, sandbox_with_tasks):
        """Test that completing a task updates player state correctly"""
        sandbox = sandbox_with_tasks
        
        # Find a player with a pending task
        player = None
        pending_task = None
        for p in sandbox['players']:
            for task in p['tasks']:
                if task['status'] == 'pending':
                    player = p
                    pending_task = task
                    break
            if pending_task:
                break
        
        if not pending_task:
            pytest.skip("No pending tasks found")
        
        initial_points = player['points']
        
        # Complete the task
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/tasks/{pending_task['taskId']}/action",
            json={'action': 'complete'},
            timeout=30,
        )
        assert response.status_code == 200, f"Complete task failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        assert updated_player['points'] >= initial_points + pending_task['basePoints']
        assert updated_player['stats']['completedTasks'] >= 1
        print(f"✅ Task completed: +{pending_task['basePoints']} XP, total: {updated_player['points']}")
    
    def test_refuse_task_updates_state(self, sandbox_with_tasks):
        """Test that refusing a task updates player state correctly"""
        sandbox = sandbox_with_tasks
        
        # Find a player with a pending task
        player = None
        pending_task = None
        for p in sandbox['players']:
            for task in p['tasks']:
                if task['status'] == 'pending':
                    player = p
                    pending_task = task
                    break
            if pending_task:
                break
        
        if not pending_task:
            pytest.skip("No pending tasks found")
        
        initial_refused = player['refusedTasks']
        
        # Refuse the task
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/tasks/{pending_task['taskId']}/action",
            json={'action': 'refuse'},
            timeout=30,
        )
        assert response.status_code == 200, f"Refuse task failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        assert updated_player['refusedTasks'] == initial_refused + 1
        print(f"✅ Task refused: refusedTasks now {updated_player['refusedTasks']}")
    
    def test_miss_task_updates_state(self, sandbox_with_tasks):
        """Test that missing a task updates player state correctly"""
        sandbox = sandbox_with_tasks
        
        # Find a player with a pending task
        player = None
        pending_task = None
        for p in sandbox['players']:
            for task in p['tasks']:
                if task['status'] == 'pending':
                    player = p
                    pending_task = task
                    break
            if pending_task:
                break
        
        if not pending_task:
            pytest.skip("No pending tasks found")
        
        initial_missed = player['missedTasks']
        
        # Miss the task
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/tasks/{pending_task['taskId']}/action",
            json={'action': 'miss'},
            timeout=30,
        )
        assert response.status_code == 200, f"Miss task failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        assert updated_player['missedTasks'] == initial_missed + 1
        print(f"✅ Task missed: missedTasks now {updated_player['missedTasks']}")


class TestEventActions:
    """Test secret mission/event actions"""
    
    @pytest.fixture
    def sandbox_with_events(self):
        """Create a sandbox with events for testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Event Action Test',
                'playerCount': 4,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_accept_event_updates_status(self, sandbox_with_events):
        """Test that accepting an event updates status correctly"""
        sandbox = sandbox_with_events
        
        # Find a player with an active event
        player = None
        active_event = None
        for p in sandbox['players']:
            for event in p['events']:
                if event['status'] == 'active' and event.get('userStatus') == 'pending':
                    player = p
                    active_event = event
                    break
            if active_event:
                break
        
        if not active_event:
            pytest.skip("No pending events found")
        
        # Accept the event
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{active_event['eventId']}/action",
            json={'action': 'accept'},
            timeout=30,
        )
        assert response.status_code == 200, f"Accept event failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        updated_event = next((e for e in updated_player['events'] if e['eventId'] == active_event['eventId']), None)
        
        assert updated_event['userStatus'] == 'accepted'
        print(f"✅ Event accepted: status now 'accepted'")
    
    def test_dismiss_event_updates_status(self, sandbox_with_events):
        """Test that dismissing an event updates status correctly"""
        sandbox = sandbox_with_events
        
        # Find a player with an active event
        player = None
        active_event = None
        for p in sandbox['players']:
            for event in p['events']:
                if event['status'] == 'active' and event.get('userStatus') == 'pending':
                    player = p
                    active_event = event
                    break
            if active_event:
                break
        
        if not active_event:
            pytest.skip("No pending events found")
        
        # Dismiss the event
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{active_event['eventId']}/action",
            json={'action': 'dismiss'},
            timeout=30,
        )
        assert response.status_code == 200, f"Dismiss event failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        updated_event = next((e for e in updated_player['events'] if e['eventId'] == active_event['eventId']), None)
        
        assert updated_event['userStatus'] == 'dismissed'
        print(f"✅ Event dismissed: status now 'dismissed'")
    
    def test_complete_event_awards_xp(self, sandbox_with_events):
        """Test that completing an event awards XP"""
        sandbox = sandbox_with_events
        
        # Find a player with an active event
        player = None
        active_event = None
        for p in sandbox['players']:
            for event in p['events']:
                if event['status'] == 'active':
                    player = p
                    active_event = event
                    break
            if active_event:
                break
        
        if not active_event:
            pytest.skip("No active events found")
        
        # First accept the event if pending
        if active_event.get('userStatus') == 'pending':
            requests.post(
                f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{active_event['eventId']}/action",
                json={'action': 'accept'},
                timeout=30,
            )
        
        initial_points = player['points']
        initial_completed = player['stats']['eventsCompleted']
        
        # Complete the event
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{active_event['eventId']}/action",
            json={'action': 'complete'},
            timeout=30,
        )
        assert response.status_code == 200, f"Complete event failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        assert updated_player['points'] > initial_points, "XP should be awarded"
        assert updated_player['stats']['eventsCompleted'] == initial_completed + 1
        print(f"✅ Event completed: +XP, eventsCompleted now {updated_player['stats']['eventsCompleted']}")


class TestScheduleEditing:
    """Test schedule editing functionality"""
    
    @pytest.fixture
    def sandbox_for_schedule(self):
        """Create a sandbox for schedule testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Schedule Test Kingdom',
                'playerCount': 3,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_update_player_schedule(self, sandbox_for_schedule):
        """Test updating a player's schedule"""
        sandbox = sandbox_for_schedule
        player = sandbox['players'][0]
        
        new_availability = {
            "weekly": {
                "Monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Wednesday": {"enabled": False, "start": "09:00", "end": "17:00"},
                "Thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "Saturday": {"enabled": True, "start": "10:00", "end": "20:00"},
                "Sunday": {"enabled": True, "start": "10:00", "end": "20:00"}
            },
            "overrides": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/schedule",
            json={'availability': new_availability},
            timeout=30,
        )
        assert response.status_code == 200, f"Update schedule failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        # Verify schedule was updated
        weekly = updated_player.get('preferences', {}).get('availability', {}).get('weekly', {})
        assert weekly.get('Wednesday', {}).get('enabled') == False
        print(f"✅ Player schedule updated successfully")


class TestNotes:
    """Test notes functionality"""
    
    @pytest.fixture
    def sandbox_for_notes(self):
        """Create a sandbox for notes testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Notes Test Kingdom',
                'playerCount': 3,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_add_note_as_player(self, sandbox_for_notes):
        """Test adding a note as a selected player"""
        sandbox = sandbox_for_notes
        player = sandbox['players'][0]
        
        note_message = "I swapped my availability because of soccer practice."
        
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/notes",
            json={'message': note_message},
            timeout=30,
        )
        assert response.status_code == 200, f"Add note failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
        
        assert len(updated_player['notes']) > 0
        latest_note = updated_player['notes'][0]
        assert latest_note['message'] == note_message
        print(f"✅ Note added successfully: '{note_message[:30]}...'")


class TestMockEndorsements:
    """Test mock endorsements and reward claiming"""
    
    @pytest.fixture
    def sandbox_with_rewards(self):
        """Create a sandbox with rewards for testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Rewards Test Kingdom',
                'playerCount': 4,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_endorsements_have_correct_structure(self, sandbox_with_rewards):
        """Test that endorsements have correct structure"""
        sandbox = sandbox_with_rewards
        
        for reward in sandbox['endorsements']:
            assert 'rewardId' in reward
            assert 'businessName' in reward
            assert 'title' in reward
            assert 'description' in reward
            assert 'rewardType' in reward
            assert 'code' in reward
            assert 'status' in reward
            assert 'targetPlayerName' in reward
        
        print(f"✅ All {len(sandbox['endorsements'])} endorsements have correct structure")
    
    def test_claim_available_reward(self, sandbox_with_rewards):
        """Test claiming an available reward"""
        sandbox = sandbox_with_rewards
        player = sandbox['players'][0]
        
        # Find an available reward
        available_reward = next(
            (r for r in sandbox['endorsements'] if r['status'] == 'available'),
            None
        )
        
        if not available_reward:
            pytest.skip("No available rewards found")
        
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/endorsements/{available_reward['rewardId']}/claim",
            json={'playerId': player['playerId']},
            timeout=30,
        )
        assert response.status_code == 200, f"Claim reward failed: {response.text}"
        
        updated_sandbox = response.json()['sandbox']
        claimed_reward = next(
            (r for r in updated_sandbox['endorsements'] if r['rewardId'] == available_reward['rewardId']),
            None
        )
        
        assert claimed_reward['status'] == 'claimed'
        print(f"✅ Reward claimed: {available_reward['businessName']} - {available_reward['title']}")


class TestManualMissionTrigger:
    """Test manual mission trigger for selected player"""
    
    @pytest.fixture
    def sandbox_for_missions(self):
        """Create a sandbox for mission testing"""
        admin_id = create_admin_household()
        response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Mission Trigger Test',
                'playerCount': 4,
            },
            timeout=30,
        )
        return response.json()['sandbox']
    
    def test_trigger_mission_for_player(self, sandbox_for_missions):
        """Test triggering a mission for a specific player"""
        sandbox = sandbox_for_missions
        
        # Find a player without active events
        player = None
        for p in sandbox['players']:
            active_events = [e for e in p['events'] if e['status'] == 'active']
            if not active_events:
                player = p
                break
        
        if not player:
            # Use first player and expect it to fail gracefully
            player = sandbox['players'][0]
        
        response = requests.post(
            f"{BASE_URL}/api/sandbox-households/{sandbox['sandboxId']}/generate-event",
            json={'playerId': player['playerId']},
            timeout=30,
        )
        
        # Should either succeed or return 400 if player already has active event
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            updated_sandbox = response.json()['sandbox']
            updated_player = next(p for p in updated_sandbox['players'] if p['playerId'] == player['playerId'])
            active_events = [e for e in updated_player['events'] if e['status'] == 'active']
            assert len(active_events) > 0
            print(f"✅ Mission triggered for {player['displayName']}")
        else:
            print(f"✅ Mission trigger correctly rejected (player already has active event)")


class TestGetSandboxEndpoints:
    """Test GET endpoints for sandbox"""
    
    def test_get_latest_sandbox_for_admin(self):
        """Test getting the latest sandbox for an admin"""
        admin_id = create_admin_household()
        
        # Create a sandbox
        create_response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'Get Test Kingdom',
                'playerCount': 3,
            },
            timeout=30,
        )
        assert create_response.status_code == 200
        created_sandbox = create_response.json()['sandbox']
        
        # Get the sandbox
        get_response = requests.get(
            f"{BASE_URL}/api/sandbox-households/admin/{admin_id}",
            timeout=30,
        )
        assert get_response.status_code == 200
        
        fetched_sandbox = get_response.json()['sandbox']
        assert fetched_sandbox['sandboxId'] == created_sandbox['sandboxId']
        print(f"✅ Successfully fetched sandbox for admin")
    
    def test_get_sandbox_by_id(self):
        """Test getting a sandbox by its ID"""
        admin_id = create_admin_household()
        
        # Create a sandbox
        create_response = requests.post(
            f'{BASE_URL}/api/sandbox-households',
            json={
                'adminUserId': admin_id,
                'householdName': 'ID Test Kingdom',
                'playerCount': 3,
            },
            timeout=30,
        )
        assert create_response.status_code == 200
        created_sandbox = create_response.json()['sandbox']
        
        # Get by ID
        get_response = requests.get(
            f"{BASE_URL}/api/sandbox-households/{created_sandbox['sandboxId']}",
            timeout=30,
        )
        assert get_response.status_code == 200
        
        fetched_sandbox = get_response.json()
        assert fetched_sandbox['sandboxId'] == created_sandbox['sandboxId']
        print(f"✅ Successfully fetched sandbox by ID")
    
    def test_get_nonexistent_sandbox_returns_null(self):
        """Test that getting a nonexistent sandbox returns null"""
        admin_id = create_admin_household()
        
        # Get sandbox for admin who hasn't created one yet
        # First create a new admin without sandbox
        new_admin_id = create_admin_household()
        
        get_response = requests.get(
            f"{BASE_URL}/api/sandbox-households/admin/{new_admin_id}",
            timeout=30,
        )
        assert get_response.status_code == 200
        assert get_response.json()['sandbox'] is None
        print(f"✅ Correctly returns null for admin without sandbox")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
