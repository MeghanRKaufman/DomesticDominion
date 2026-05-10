import datetime
import uuid

import requests

API_BASE = 'http://127.0.0.1:8001/api'
WEEKLY_ALWAYS_AVAILABLE = {
    day: {"enabled": True, "start": "00:00", "end": "23:59"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}


def create_household_with_two_members():
    payload = {
        "householdName": f"Duel House {uuid.uuid4().hex[:6]}",
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
    assign = requests.post(
        f"{API_BASE}/households/{created['householdId']}/assign-chores",
        params={'admin_user_id': created['userId']},
        timeout=30,
    )
    assign.raise_for_status()
    return created, join


def get_first_pending_task(household_id, user_id):
    today = datetime.date.today().isoformat()
    response = requests.get(
        f'{API_BASE}/households/{household_id}/my-tasks/{user_id}',
        params={'date': today},
        timeout=30,
    )
    response.raise_for_status()
    tasks = [task for room_tasks in response.json().values() for task in room_tasks]
    return next(task for task in tasks if not task.get('completed'))


def test_rps_duel_flow_reassigns_task():
    created, joined = create_household_with_two_members()
    first_task = get_first_pending_task(created['householdId'], created['userId'])

    create_challenge = requests.post(
        f'{API_BASE}/mini-game-challenges/create',
        json={
            'challengerId': created['userId'],
            'challengedId': joined['userId'],
            'taskId': first_task['taskId'],
            'gameType': 'rock_paper_scissors',
            'roundCount': 1,
        },
        timeout=30,
    )
    create_challenge.raise_for_status()
    challenge = create_challenge.json()['challenge']

    accept = requests.post(
        f'{API_BASE}/mini-game-challenges/respond',
        json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
        timeout=30,
    )
    accept.raise_for_status()

    play_one = requests.post(
        f'{API_BASE}/mini-game-challenges/play',
        json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'move': 'rock'},
        timeout=30,
    )
    play_one.raise_for_status()

    play_two = requests.post(
        f'{API_BASE}/mini-game-challenges/play',
        json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'move': 'scissors'},
        timeout=30,
    )
    play_two.raise_for_status()
    resolved = play_two.json()['challenge']

    assert resolved['status'] == 'awaiting_choice'
    assert resolved['winnerId'] == created['userId']

    assign = requests.post(
        f'{API_BASE}/mini-game-challenges/assign-task',
        json={'challengeId': challenge['challengeId'], 'chooserId': created['userId'], 'choice': 'them'},
        timeout=30,
    )
    assign.raise_for_status()

    tasks_response = requests.get(
        f'{API_BASE}/tasks',
        params={'householdId': created['householdId'], 'date': datetime.date.today().isoformat()},
        timeout=30,
    )
    tasks_response.raise_for_status()
    updated_task = next(task for task in tasks_response.json() if task['taskId'] == first_task['taskId'])
    assert updated_task['assignedTo'] == joined['userId']
    assert not updated_task.get('duelPending', False)


def test_trivia_duel_acceptance_and_round_resolution():
    created, joined = create_household_with_two_members()
    first_task = get_first_pending_task(created['householdId'], created['userId'])

    challenge = requests.post(
        f'{API_BASE}/mini-game-challenges/create',
        json={
            'challengerId': created['userId'],
            'challengedId': joined['userId'],
            'taskId': first_task['taskId'],
            'gameType': 'trivia',
            'roundCount': 1,
        },
        timeout=30,
    ).json()['challenge']

    accept = requests.post(
        f'{API_BASE}/mini-game-challenges/respond',
        json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
        timeout=30,
    )
    accept.raise_for_status()
    accepted = accept.json()['challenge']
    current_round = accepted['currentRoundState']
    correct_index = current_round['promptData']['correctIndex']
    wrong_index = 0 if correct_index != 0 else 1

    first_answer = requests.post(
        f'{API_BASE}/mini-game-challenges/play',
        json={
            'challengeId': challenge['challengeId'],
            'userId': created['userId'],
            'roundNumber': 1,
            'answerIndex': correct_index,
            'durationMs': 1200,
        },
        timeout=30,
    )
    first_answer.raise_for_status()

    second_answer = requests.post(
        f'{API_BASE}/mini-game-challenges/play',
        json={
            'challengeId': challenge['challengeId'],
            'userId': joined['userId'],
            'roundNumber': 1,
            'answerIndex': wrong_index,
            'durationMs': 900,
        },
        timeout=30,
    )
    second_answer.raise_for_status()


def test_new_roster_games_create_and_war_resolves():
    created, joined = create_household_with_two_members()
    first_task = get_first_pending_task(created['householdId'], created['userId'])

    for game_type in ['memory_flip', 'boxes', 'war']:
        challenge_response = requests.post(
            f'{API_BASE}/mini-game-challenges/create',
            json={
                'challengerId': created['userId'],
                'challengedId': joined['userId'],
                'taskId': first_task['taskId'],
                'gameType': game_type,
                'roundCount': 1,
            },
            timeout=30,
        )
        challenge_response.raise_for_status()
        challenge = challenge_response.json()['challenge']
        assert challenge['gameType'] == game_type

        if game_type == 'war':
            accept = requests.post(
                f'{API_BASE}/mini-game-challenges/respond',
                json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'accept'},
                timeout=30,
            )
            accept.raise_for_status()

            first_score = requests.post(
                f'{API_BASE}/mini-game-challenges/play',
                json={'challengeId': challenge['challengeId'], 'userId': created['userId'], 'roundNumber': 1, 'score': 4},
                timeout=30,
            )
            first_score.raise_for_status()
            second_score = requests.post(
                f'{API_BASE}/mini-game-challenges/play',
                json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'roundNumber': 1, 'score': 1},
                timeout=30,
            )
            second_score.raise_for_status()
            resolved = second_score.json()['challenge']
            assert resolved['winnerId'] == created['userId']
            assert resolved['status'] == 'awaiting_choice'
        else:
            decline = requests.post(
                f'{API_BASE}/mini-game-challenges/respond',
                json={'challengeId': challenge['challengeId'], 'userId': joined['userId'], 'response': 'decline'},
                timeout=30,
            )
            decline.raise_for_status()
