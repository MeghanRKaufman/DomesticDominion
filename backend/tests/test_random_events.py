import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv('/app/backend/.env')

API_BASE = 'http://127.0.0.1:8001/api'
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
WEEKLY_ALWAYS_AVAILABLE = {
    day: {"enabled": True, "start": "00:00", "end": "23:59"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}


def create_household_with_members(member_count=2):
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
            "availability": {"weekly": WEEKLY_ALWAYS_AVAILABLE, "overrides": {}},
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
                    'availability': {'weekly': WEEKLY_ALWAYS_AVAILABLE, 'overrides': {}},
                    'choreAversions': [],
                    'preferredTasks': [],
                    'maxDailyChoreLoad': 4,
                },
            },
            timeout=30,
        )
        join_response.raise_for_status()
        member_ids.append(join_response.json()['userId'])

    return created['householdId'], member_ids


@pytest.fixture(scope='module')
def db():
    client = MongoClient(MONGO_URL)
    database = client[DB_NAME]
    yield database
    client.close()


def test_random_event_generation_and_completion():
    _, member_ids = create_household_with_members(member_count=2)
    admin_id = member_ids[0]

    event_response = requests.get(
        f'{API_BASE}/random-events/user/{admin_id}',
        params={'trigger': 'pytest'},
        timeout=30,
    )
    event_response.raise_for_status()
    event_payload = event_response.json()['event']

    assert event_payload is not None
    assert event_payload['themeName']

    accept_response = requests.post(
        f"{API_BASE}/random-events/{event_payload['eventId']}/respond",
        json={'userId': admin_id, 'response': 'accept'},
        timeout=30,
    )
    accept_response.raise_for_status()
    assert accept_response.json()['event']['userStatus'] == 'accepted'

    complete_response = requests.post(
        f"{API_BASE}/random-events/{event_payload['eventId']}/complete",
        json={'userId': admin_id},
        timeout=30,
    )
    complete_response.raise_for_status()
    complete_payload = complete_response.json()

    assert complete_payload['xpAwarded'] > 0

    user_response = requests.get(f'{API_BASE}/users/{admin_id}', timeout=30)
    user_response.raise_for_status()
    assert user_response.json()['points'] == complete_payload['points']


def test_pair_event_completion_creates_follow_up(db):
    household_id, member_ids = create_household_with_members(member_count=2)
    first_user, second_user = member_ids
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    event_id = f'event_{uuid.uuid4().hex[:10]}'
    db.random_events.insert_one({
        'eventId': event_id,
        'householdId': household_id,
        'date': today,
        'eventType': 'pair',
        'themeName': 'National Earth Day',
        'title': 'Secret Side Mission: National Earth Day',
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

    complete_response = requests.post(
        f'{API_BASE}/random-events/{event_id}/complete',
        json={'userId': first_user},
        timeout=30,
    )
    complete_response.raise_for_status()
    payload = complete_response.json()

    assert second_user in payload['reofferedUserIds']

    follow_up_event = db.random_events.find_one(
        {'parentEventId': event_id, 'participants.userId': second_user},
        {'_id': 0},
    )
    assert follow_up_event is not None
    assert follow_up_event['eventType'] == 'follow_up'

    parent_event = db.random_events.find_one({'eventId': event_id}, {'_id': 0})
    second_participant = next(item for item in parent_event['participants'] if item['userId'] == second_user)
    assert second_participant['status'] == 'reassigned'
