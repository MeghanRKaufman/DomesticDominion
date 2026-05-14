"""Tests for the Epic Invite endpoint."""
import uuid

import requests

API_BASE = "http://127.0.0.1:8001/api"
WAA = {d: {"enabled": True, "start": "00:00", "end": "23:59"}
       for d in ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]}


def create_household():
    payload = {
        "householdName": f"Invite House {uuid.uuid4().hex[:6]}",
        "adminName": "Invite Admin",
        "householdType": "roommates",
        "memberLimit": 4,
        "householdSetup": {
            "rooms": {"bedrooms": 2, "bathrooms": 1, "kitchen": True, "livingRoom": True},
            "laundryType": "in_unit","dryingMethod": ["dryer"],"trashDays": ["Monday"],
            "pets": [], "vehicles": [],
            "availability": {"weekly": WAA, "overrides": {}},
            "choreAversions": [], "preferredTasks": [], "maxDailyChoreLoad": 6,
        },
    }
    return requests.post(f"{API_BASE}/households/create-enhanced", json=payload, timeout=30).json()


def test_epic_invite_returns_full_payload():
    h = create_household()
    r = requests.get(
        f"{API_BASE}/households/{h['householdId']}/epic-invite",
        params={"inviter_id": h["userId"]},
        timeout=20,
    )
    r.raise_for_status()
    data = r.json()
    assert data["inviteCode"] == h["inviteCode"]
    assert data["inviterName"] == "Invite Admin"
    assert data["tone"] in {"epic", "hype", "chill"}
    assert "headline" in data["hook"] and "body" in data["hook"] and "cta" in data["hook"]
    assert data["appName"] == "Domestic Dominion"
    assert isinstance(data["valueBullets"], list) and len(data["valueBullets"]) >= 3
    assert data["currentMembers"] == 1
    assert data["maxMembers"] == 4
    assert data["seatsOpen"] == 3
    assert data["inviterName"] in data["summonLine"]
    assert data["householdName"] in data["summonLine"]


def test_epic_invite_tone_override():
    h = create_household()
    for tone in ("epic", "hype", "chill"):
        r = requests.get(
            f"{API_BASE}/households/{h['householdId']}/epic-invite",
            params={"inviter_id": h["userId"], "tone": tone},
            timeout=20,
        )
        r.raise_for_status()
        assert r.json()["tone"] == tone


def test_epic_invite_falls_back_to_creator_when_no_inviter_id():
    h = create_household()
    r = requests.get(f"{API_BASE}/households/{h['householdId']}/epic-invite", timeout=20)
    r.raise_for_status()
    assert r.json()["inviterName"] == "Invite Admin"


def test_epic_invite_404_when_household_missing():
    r = requests.get(f"{API_BASE}/households/household_doesnotexist/epic-invite", timeout=20)
    assert r.status_code == 404
