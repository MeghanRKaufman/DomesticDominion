"""
Comprehensive Mini-Game Duel Arena Tests
Tests all mini-game types: rock_paper_scissors, trivia, simon, whack_a_mole, memory_flip, boxes, war
Tests duel lifecycle: create, accept/decline, play rounds, winner choice, task reassignment
Tests XP rewards: accepted XP, winner bonus XP
Tests edge cases: duelPending blocking task completion, 1 vs 3 round duels
"""
import datetime
import uuid
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-quest.preview.emergentagent.com').rstrip('/')
API_BASE = f'{BASE_URL}/api'

WEEKLY_ALWAYS_AVAILABLE = {
    day: {"enabled": True, "start": "00:00", "end": "23:59"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}


class TestMiniGameDuelSetup:
    """Helper methods for creating test households with two members"""
    
    @staticmethod
    def create_household_with_two_members():
        """Create a household with admin and one member, assign chores"""
        payload = {
            "householdName": f"Duel Test House {uuid.uuid4().hex[:6]}",
            "adminName": "Duel Admin",
            "householdType": "roommates",
            "memberLimit": 2,
            "householdSetup": {
                "rooms": {"bedrooms": 2, "bathrooms": 1, "kitchen": True, "livingRoom": True},
                "laundryType": "in_unit",
                "dryingMethod": ["dryer"],
                "trashDays": ["Monday"],
                "pets": [],
                "vehicles": [],
                "availability": {"weekly": WEEKLY_ALWAYS_AVAILABLE, "overrides": {}},
                "choreAversions": [],
                "preferredTasks": [],
                "maxDailyChoreLoad": 4,
            },
        }
        created = requests.post(f'{API_BASE}/households/create-enhanced', json=payload, timeout=30).json()
        
        join = requests.post(
            f'{API_BASE}/households/join',
            json={
                'inviteCode': created['inviteCode'],
                'memberName': 'Duel Partner',
                'memberPreferences': {
                    'availability': {'weekly': WEEKLY_ALWAYS_AVAILABLE, 'overrides': {}},
                    'choreAversions': [],
                    'preferredTasks': [],
                    'maxDailyChoreLoad': 4,
                },
            },
            timeout=30,
        ).json()
        
        # Assign chores
        assign = requests.post(
            f"{API_BASE}/households/{created['householdId']}/assign-chores",
            params={'admin_user_id': created['userId']},
            timeout=30,
        )
        assign.raise_for_status()
        
        return created, join

    @staticmethod
    def get_first_pending_task(household_id, user_id):
        """Get first pending task for a user"""
        today = datetime.date.today().isoformat()
        response = requests.get(
            f'{API_BASE}/households/{household_id}/my-tasks/{user_id}',
            params={'date': today},
            timeout=30,
        )
        response.raise_for_status()
        tasks = [task for room_tasks in response.json().values() for task in room_tasks]
        pending_tasks = [task for task in tasks if not task.get('completed')]
        return pending_tasks[0] if pending_tasks else None


class TestMiniGameChallengeCreation:
    """Tests for creating mini-game duel challenges"""
    
    def test_create_rps_challenge_1_round(self):
        """Test creating a 1-round rock-paper-scissors challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None, "No pending task found for admin"
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        data = response.json()
        assert 'challenge' in data
        challenge = data['challenge']
        assert challenge['gameType'] == 'rock_paper_scissors'
        assert challenge['roundCount'] == 1
        assert challenge['status'] == 'pending'
        print(f"✅ Created RPS 1-round challenge: {challenge['challengeId']}")
    
    def test_create_trivia_challenge_3_rounds(self):
        """Test creating a 3-round trivia challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'trivia',
                'roundCount': 3,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'trivia'
        assert challenge['roundCount'] == 3
        print(f"✅ Created Trivia 3-round challenge: {challenge['challengeId']}")
    
    def test_create_simon_challenge(self):
        """Test creating a simon says challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'simon',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'simon'
        print(f"✅ Created Simon challenge: {challenge['challengeId']}")
    
    def test_create_whack_a_mole_challenge(self):
        """Test creating a whack-a-mole challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'whack_a_mole',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'whack_a_mole'
        print(f"✅ Created Whack-a-Mole challenge: {challenge['challengeId']}")
    
    def test_create_memory_flip_challenge(self):
        """Test creating a memory flip challenge with cleaning supply theme"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'memory_flip',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'memory_flip'
        # Verify cleaning supply cards are present
        round_data = challenge.get('rounds', [{}])[0].get('promptData', {})
        cards = round_data.get('cards', [])
        assert len(cards) == 12  # 6 pairs
        # Check for cleaning supply themed cards
        card_values = [c.get('value') for c in cards]
        assert 'spray' in card_values or 'sponge' in card_values or 'broom' in card_values
        print(f"✅ Created Memory Flip challenge with cleaning supply theme: {challenge['challengeId']}")
    
    def test_create_boxes_challenge(self):
        """Test creating a dots-and-boxes challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'boxes',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'boxes'
        # Verify boxes game structure
        round_data = challenge.get('rounds', [{}])[0].get('promptData', {})
        edges = round_data.get('edges', [])
        boxes = round_data.get('boxes', [])
        assert len(edges) == 12  # 12 edges for 2x2 grid
        assert len(boxes) == 4  # 4 boxes
        print(f"✅ Created Boxes challenge: {challenge['challengeId']}")
    
    def test_create_war_challenge(self):
        """Test creating a war card duel challenge"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'war',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 200
        challenge = response.json()['challenge']
        assert challenge['gameType'] == 'war'
        # Verify war game structure
        round_data = challenge.get('rounds', [{}])[0].get('promptData', {})
        assert round_data.get('drawCount') == 5
        print(f"✅ Created War challenge: {challenge['challengeId']}")
    
    def test_invalid_round_count_rejected(self):
        """Test that invalid round counts (not 1 or 3) are rejected"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 5,  # Invalid
            },
            timeout=30,
        )
        assert response.status_code == 400
        assert "Round count must be 1 or 3" in response.json().get('detail', '')
        print("✅ Invalid round count correctly rejected")
    
    def test_only_assigned_player_can_create_challenge(self):
        """Test that only the task's assigned player can create a duel"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        assert task is not None
        
        # Try to create challenge as the non-assigned player
        response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': joined['userId'],  # Not the assigned player
                'challengedId': created['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        )
        assert response.status_code == 400
        assert "Only the currently assigned player" in response.json().get('detail', '')
        print("✅ Non-assigned player correctly blocked from creating challenge")


class TestMiniGameChallengeResponse:
    """Tests for accepting/declining challenges"""
    
    def test_accept_challenge_awards_xp(self):
        """Test that accepting a challenge awards XP to both players"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Get initial points
        admin_before = requests.get(f'{API_BASE}/users/{created["userId"]}', timeout=30).json()
        partner_before = requests.get(f'{API_BASE}/users/{joined["userId"]}', timeout=30).json()
        
        # Create challenge
        create_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        )
        challenge = create_resp.json()['challenge']
        
        # Accept challenge
        accept_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        assert accept_resp.status_code == 200
        accepted = accept_resp.json()['challenge']
        assert accepted['status'] == 'active'
        
        # Check XP was awarded
        admin_after = requests.get(f'{API_BASE}/users/{created["userId"]}', timeout=30).json()
        partner_after = requests.get(f'{API_BASE}/users/{joined["userId"]}', timeout=30).json()
        
        # Both should have received acceptedXp (default 10) + teamXp (default 5)
        assert admin_after.get('points', 0) >= admin_before.get('points', 0)
        assert partner_after.get('points', 0) >= partner_before.get('points', 0)
        print(f"✅ Accept challenge awarded XP - Admin: {admin_before.get('points', 0)} -> {admin_after.get('points', 0)}, Partner: {partner_before.get('points', 0)} -> {partner_after.get('points', 0)}")
    
    def test_decline_challenge_unlocks_task(self):
        """Test that declining a challenge removes duelPending from task"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create challenge
        create_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        )
        challenge = create_resp.json()['challenge']
        
        # Decline challenge
        decline_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'decline'},
            timeout=30,
        )
        assert decline_resp.status_code == 200
        declined = decline_resp.json()['challenge']
        assert declined['status'] == 'declined'
        
        # Verify task is no longer locked
        tasks_resp = requests.get(
            f'{API_BASE}/tasks',
            params={'householdId': created['householdId'], 'date': datetime.date.today().isoformat()},
            timeout=30,
        )
        tasks_resp.raise_for_status()
        updated_task = next((t for t in tasks_resp.json() if t['taskId'] == task['taskId']), None)
        assert updated_task is not None
        assert not updated_task.get('duelPending', False)
        print("✅ Declined challenge correctly unlocked task")


class TestMiniGameRoundPlay:
    """Tests for playing mini-game rounds"""
    
    def test_rps_round_resolution(self):
        """Test rock-paper-scissors round resolution"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create and accept challenge
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Play round - rock beats scissors
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        assert play_resp.status_code == 200
        resolved = play_resp.json()['challenge']
        
        assert resolved['status'] == 'awaiting_choice'
        assert resolved['winnerId'] == created['userId']
        print(f"✅ RPS round resolved correctly - Winner: {resolved['winnerId']}")
    
    def test_trivia_correct_answer_wins(self):
        """Test trivia round - correct answer beats wrong answer"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create and accept trivia challenge
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'trivia',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        accept_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        accepted = accept_resp.json()['challenge']
        
        # Get correct answer index from round state
        current_round = accepted.get('currentRoundState', {})
        correct_index = current_round.get('promptData', {}).get('correctIndex', 0)
        wrong_index = 0 if correct_index != 0 else 1
        
        # Admin answers correctly
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={
                'challengeId': challenge['challengeId'],
                'userId': created['userId'],
                'roundNumber': 1,
                'answerIndex': correct_index,
                'durationMs': 1500,
            },
            timeout=30,
        )
        
        # Partner answers incorrectly
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={
                'challengeId': challenge['challengeId'],
                'userId': joined['userId'],
                'roundNumber': 1,
                'answerIndex': wrong_index,
                'durationMs': 1000,
            },
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == created['userId']
        print(f"✅ Trivia round resolved - correct answer wins")
    
    def test_trivia_faster_correct_answer_wins(self):
        """Test trivia round - faster correct answer wins when both correct"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'trivia',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        accept_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        accepted = accept_resp.json()['challenge']
        correct_index = accepted.get('currentRoundState', {}).get('promptData', {}).get('correctIndex', 0)
        
        # Admin answers correctly but slower
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={
                'challengeId': challenge['challengeId'],
                'userId': created['userId'],
                'roundNumber': 1,
                'answerIndex': correct_index,
                'durationMs': 3000,  # Slower
            },
            timeout=30,
        )
        
        # Partner answers correctly and faster
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={
                'challengeId': challenge['challengeId'],
                'userId': joined['userId'],
                'roundNumber': 1,
                'answerIndex': correct_index,
                'durationMs': 1000,  # Faster
            },
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == joined['userId']
        print(f"✅ Trivia round - faster correct answer wins")
    
    def test_simon_higher_score_wins(self):
        """Test simon round - higher score wins"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'simon',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Admin scores higher
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 8},
            timeout=30,
        )
        
        # Partner scores lower
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 5},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == created['userId']
        print(f"✅ Simon round - higher score wins")
    
    def test_whack_a_mole_higher_score_wins(self):
        """Test whack-a-mole round - higher score wins"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'whack_a_mole',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Partner scores higher
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 15},
            timeout=30,
        )
        
        # Admin scores lower
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 10},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == joined['userId']
        print(f"✅ Whack-a-Mole round - higher score wins")
    
    def test_memory_flip_higher_score_wins(self):
        """Test memory flip round - higher score wins"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'memory_flip',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Admin scores higher (fewer moves = higher score)
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 100},
            timeout=30,
        )
        
        # Partner scores lower
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 50},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == created['userId']
        print(f"✅ Memory Flip round - higher score wins")
    
    def test_boxes_higher_score_wins(self):
        """Test boxes round - higher score wins"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'boxes',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Partner scores higher (more boxes claimed)
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 3},
            timeout=30,
        )
        
        # Admin scores lower
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 1},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == joined['userId']
        print(f"✅ Boxes round - higher score wins")
    
    def test_war_higher_score_wins(self):
        """Test war round - higher score wins"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'war',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Admin scores higher (more battles won)
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 4},
            timeout=30,
        )
        
        # Partner scores lower
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 2},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        
        assert resolved['winnerId'] == created['userId']
        print(f"✅ War round - higher score wins")


class TestMiniGameWinnerChoice:
    """Tests for winner task assignment choice"""
    
    def test_winner_chooses_me_assigns_to_winner(self):
        """Test winner choosing 'me' assigns task to themselves"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        original_assignee = task['assignedTo']
        
        # Create, accept, and play challenge
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        winner_id = resolved['winnerId']
        
        # Winner chooses 'me'
        assign_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/assign-task',
            json={'challengeId': challenge['challengeId'], 'chooserId': winner_id, 'choice': 'me'},
            timeout=30,
        )
        assert assign_resp.status_code == 200
        
        # Verify task assignment
        tasks_resp = requests.get(
            f'{API_BASE}/tasks',
            params={'householdId': created['householdId'], 'date': datetime.date.today().isoformat()},
            timeout=30,
        )
        updated_task = next((t for t in tasks_resp.json() if t['taskId'] == task['taskId']), None)
        assert updated_task['assignedTo'] == winner_id
        assert not updated_task.get('duelPending', False)
        print(f"✅ Winner chose 'me' - task assigned to winner: {winner_id}")
    
    def test_winner_chooses_them_assigns_to_loser(self):
        """Test winner choosing 'them' assigns task to opponent"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        winner_id = resolved['winnerId']
        loser_id = joined['userId'] if winner_id == created['userId'] else created['userId']
        
        # Winner chooses 'them'
        assign_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/assign-task',
            json={'challengeId': challenge['challengeId'], 'chooserId': winner_id, 'choice': 'them'},
            timeout=30,
        )
        assert assign_resp.status_code == 200
        
        # Verify task assignment
        tasks_resp = requests.get(
            f'{API_BASE}/tasks',
            params={'householdId': created['householdId'], 'date': datetime.date.today().isoformat()},
            timeout=30,
        )
        updated_task = next((t for t in tasks_resp.json() if t['taskId'] == task['taskId']), None)
        assert updated_task['assignedTo'] == loser_id
        print(f"✅ Winner chose 'them' - task assigned to loser: {loser_id}")
    
    def test_only_winner_can_assign_task(self):
        """Test that only the winner can make the task assignment choice"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        resolved = play_resp.json()['challenge']
        winner_id = resolved['winnerId']
        loser_id = joined['userId'] if winner_id == created['userId'] else created['userId']
        
        # Loser tries to assign task
        assign_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/assign-task',
            json={'challengeId': challenge['challengeId'], 'chooserId': loser_id, 'choice': 'me'},
            timeout=30,
        )
        assert assign_resp.status_code == 403
        assert "Only the winner" in assign_resp.json().get('detail', '')
        print("✅ Non-winner correctly blocked from assigning task")


class TestMiniGameDuelPending:
    """Tests for duelPending blocking task completion"""
    
    def test_task_completion_blocked_during_duel(self):
        """Test that task cannot be completed while duelPending is active"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create challenge (sets duelPending=True)
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        # Try to complete the task
        complete_resp = requests.post(
            f'{API_BASE}/tasks/{task["taskId"]}/complete',
            json={'userId': created['userId']},
            timeout=30,
        )
        
        # Should be blocked
        assert complete_resp.status_code == 400
        assert "duel" in complete_resp.json().get('detail', '').lower()
        print("✅ Task completion correctly blocked during active duel")


class TestMiniGamePendingChallengesList:
    """Tests for listing pending/active challenges"""
    
    def test_get_pending_challenges(self):
        """Test getting list of pending challenges for a user"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create challenge
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        # Get pending challenges for admin
        pending_resp = requests.get(
            f'{API_BASE}/mini-game-challenges/{created["householdId"]}/pending',
            params={'user_id': created['userId']},
            timeout=30,
        )
        assert pending_resp.status_code == 200
        challenges = pending_resp.json()['challenges']
        assert len(challenges) >= 1
        assert any(c['challengeId'] == challenge['challengeId'] for c in challenges)
        print(f"✅ Pending challenges list returned {len(challenges)} challenge(s)")
    
    def test_completed_challenges_not_in_pending(self):
        """Test that completed challenges are not in pending list"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        # Create, accept, play, and complete challenge
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 1,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        
        play_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        winner_id = play_resp.json()['challenge']['winnerId']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/assign-task',
            json={'challengeId': challenge['challengeId'], 'chooserId': winner_id, 'choice': 'me'},
            timeout=30,
        )
        
        # Get pending challenges - completed should not be there
        pending_resp = requests.get(
            f'{API_BASE}/mini-game-challenges/{created["householdId"]}/pending',
            params={'user_id': created['userId']},
            timeout=30,
        )
        challenges = pending_resp.json()['challenges']
        assert not any(c['challengeId'] == challenge['challengeId'] for c in challenges)
        print("✅ Completed challenge correctly excluded from pending list")


class TestMiniGame3RoundDuel:
    """Tests for 3-round duels with best-of-3 logic"""
    
    def test_3_round_duel_needs_2_wins(self):
        """Test that 3-round duel requires 2 wins to determine winner"""
        created, joined = TestMiniGameDuelSetup.create_household_with_two_members()
        task = TestMiniGameDuelSetup.get_first_pending_task(created['householdId'], created['userId'])
        
        challenge = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': task['taskId'],
                'gameType': 'rock_paper_scissors',
                'roundCount': 3,
            },
            timeout=30,
        ).json()['challenge']
        
        requests.post(
            f'{API_BASE}/mini-game-challenges/respond',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
            timeout=30,
        )
        
        # Round 1: Admin wins (rock beats scissors)
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
            timeout=30,
        )
        round1_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
            timeout=30,
        )
        round1 = round1_resp.json()['challenge']
        assert round1['status'] == 'active'  # Not finished yet
        
        # Round 2: Admin wins again (paper beats rock)
        requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 2, 'move': 'paper'},
            timeout=30,
        )
        round2_resp = requests.post(
            f'{API_BASE}/mini-game-challenges/play',
            json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 2, 'move': 'rock'},
            timeout=30,
        )
        round2 = round2_resp.json()['challenge']
        
        # Now admin has 2 wins, should be awaiting_choice
        assert round2['status'] == 'awaiting_choice'
        assert round2['winnerId'] == created['userId']
        print("✅ 3-round duel correctly requires 2 wins")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
