import uuid

import requests

API_BASE = 'http://127.0.0.1:8001/api'


def create_admin_household():
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
    response = requests.post(f'{API_BASE}/households/create-enhanced', json=payload, timeout=30)
    response.raise_for_status()
    return response.json()['userId']


def test_create_sandbox_household_and_overview():
    admin_id = create_admin_household()
    create_response = requests.post(
        f'{API_BASE}/sandbox-households',
        json={
            'adminUserId': admin_id,
            'householdName': 'Whole House Preview',
            'playerCount': 4,
        },
        timeout=30,
    )
    create_response.raise_for_status()
    sandbox = create_response.json()['sandbox']

    assert sandbox['householdName'] == 'Whole House Preview'
    assert sandbox['metrics']['playerCount'] == 4
    assert sandbox['metrics']['taskCount'] > 0
    assert len(sandbox['players']) == 4
    assert len(sandbox['endorsements']) >= 2


def test_sandbox_player_actions_and_reward_claim():
    admin_id = create_admin_household()
    sandbox = requests.post(
        f'{API_BASE}/sandbox-households',
        json={
            'adminUserId': admin_id,
            'householdName': 'Perspective Test',
            'playerCount': 3,
        },
        timeout=30,
    ).json()['sandbox']

    player = sandbox['players'][0]
    pending_task = next(task for task in player['tasks'] if task['status'] == 'pending')
    task_response = requests.post(
        f"{API_BASE}/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/tasks/{pending_task['taskId']}/action",
        json={'action': 'complete'},
        timeout=30,
    )
    task_response.raise_for_status()
    sandbox_after_task = task_response.json()['sandbox']
    refreshed_player = next(item for item in sandbox_after_task['players'] if item['playerId'] == player['playerId'])
    assert refreshed_player['points'] >= pending_task['basePoints']
    assert refreshed_player['stats']['completedTasks'] >= 1

    event = next(evt for evt in refreshed_player['events'] if evt['status'] == 'active')
    accept_response = requests.post(
        f"{API_BASE}/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{event['eventId']}/action",
        json={'action': 'accept'},
        timeout=30,
    )
    accept_response.raise_for_status()

    complete_response = requests.post(
        f"{API_BASE}/sandbox-households/{sandbox['sandboxId']}/players/{player['playerId']}/events/{event['eventId']}/action",
        json={'action': 'complete'},
        timeout=30,
    )
    complete_response.raise_for_status()
    sandbox_after_event = complete_response.json()['sandbox']
    event_player = next(item for item in sandbox_after_event['players'] if item['playerId'] == player['playerId'])
    assert event_player['stats']['eventsCompleted'] >= 1

    available_reward = next(reward for reward in sandbox_after_event['endorsements'] if reward['status'] == 'available')
    claim_response = requests.post(
        f"{API_BASE}/sandbox-households/{sandbox['sandboxId']}/endorsements/{available_reward['rewardId']}/claim",
        json={'playerId': player['playerId']},
        timeout=30,
    )
    claim_response.raise_for_status()
    sandbox_after_claim = claim_response.json()['sandbox']
    claimed_reward = next(reward for reward in sandbox_after_claim['endorsements'] if reward['rewardId'] == available_reward['rewardId'])
    assert claimed_reward['status'] == 'claimed'
