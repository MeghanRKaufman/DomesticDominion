"""Phase 2 — Dynamic Capacity Engine tests."""
import datetime
import uuid

import requests

API_BASE = "http://127.0.0.1:8001/api"

# Helper: build availability windows
def avail(start="08:00", end="22:00", enabled=True):
    return {d: {"enabled": enabled, "start": start, "end": end}
            for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]}


def _create_household(creator_avail=None, member_avails=None):
    """Create a household with admin + optional joined members.
    creator_avail / each member_avails is a weekly dict like avail()."""
    creator_avail = creator_avail or avail()
    payload = {
        "householdName": f"Capacity House {uuid.uuid4().hex[:6]}",
        "adminName": "Capacity Admin",
        "householdType": "roommates",
        "memberLimit": 4,
        "governance": "round_table",
        "creatorRole": "resident_manager",
        "creatorLivesInHousehold": True,
        "householdSetup": {
            "rooms": {"bedrooms": 2, "bathrooms": 1, "kitchen": True, "livingRoom": True, "patio": True},
            "laundryType": "in_unit", "dryingMethod": ["dryer"], "trashDays": ["Monday"],
            "pets": [], "vehicles": [],
            "availability": {"weekly": creator_avail, "overrides": {}},
            "choreAversions": [], "preferredTasks": [],
        },
    }
    h = requests.post(f"{API_BASE}/households/create-enhanced", json=payload, timeout=30).json()
    members = [h]
    for i, a in enumerate(member_avails or []):
        joined = requests.post(f"{API_BASE}/households/join", json={
            "memberName": f"Capacity M{i+1}",
            "inviteCode": h["inviteCode"],
            "memberPreferences": {
                "availability": {"weekly": a, "overrides": {}},
                "choreAversions": [], "preferredTasks": [],
            },
        }, timeout=30).json()
        members.append(joined)
    return h, members


def _today():
    return datetime.date.today().isoformat()


def _tasks_for(household_id, user_id):
    today = _today()
    mt = requests.get(
        f"{API_BASE}/households/{household_id}/my-tasks/{user_id}",
        params={"date": today},
        timeout=30,
    ).json()
    return [t for tl in mt.values() for t in tl if not t.get("completed")]


# =====================================================
# 1. Capacity calculation
# =====================================================
def test_capacity_endpoint_returns_minutes_based_on_window():
    """A 14-hour window (08:00–22:00) with 15% buffer = 714 minutes capacity."""
    h, _ = _create_household(creator_avail=avail("08:00", "22:00"))
    r = requests.get(f"{API_BASE}/users/{h['userId']}/capacity", timeout=20).json()
    assert r["isChoreParticipant"] is True
    # 14h * 60 * 0.85 = 714
    assert 700 <= r["capacityMinutes"] <= 720, f"got {r['capacityMinutes']}"
    assert r["availabilityWindow"]["start"] == "08:00"
    assert r["availabilityWindow"]["end"] == "22:00"


def test_capacity_zero_when_day_disabled():
    weekly = avail("08:00", "22:00")
    today = datetime.date.today().strftime("%A")
    weekly[today]["enabled"] = False
    h, _ = _create_household(creator_avail=weekly)
    r = requests.get(f"{API_BASE}/users/{h['userId']}/capacity", timeout=20).json()
    assert r["capacityMinutes"] == 0
    assert r["availabilityWindow"] is None


def test_capacity_for_external_supervisor_is_zero():
    payload = {
        "householdName": f"Sup House {uuid.uuid4().hex[:6]}",
        "adminName": "Sup",
        "householdType": "roommates", "memberLimit": 3,
        "governance": "external_oversight",
        "creatorRole": "external_supervisor",
        "creatorLivesInHousehold": False,
        "supervisorPermissions": "full_overseer",
        "householdSetup": {
            "rooms": {"bedrooms": 2, "bathrooms": 1, "kitchen": True, "livingRoom": True},
            "laundryType": "in_unit", "dryingMethod": ["dryer"], "trashDays": ["Monday"],
            "pets": [], "vehicles": [],
            "availability": {"weekly": avail(), "overrides": {}},
            "choreAversions": [], "preferredTasks": [],
        },
    }
    h = requests.post(f"{API_BASE}/households/create-enhanced", json=payload, timeout=30).json()
    r = requests.get(f"{API_BASE}/users/{h['userId']}/capacity", timeout=20).json()
    assert r["isChoreParticipant"] is False
    assert r["capacityMinutes"] == 0


# =====================================================
# 2. Scheduling precision
# =====================================================
def test_scheduling_precision_setting_persists():
    h, _ = _create_household()
    for p in ["flexible", "time_window", "suggested_time", "scheduled_block", "precision"]:
        r = requests.patch(
            f"{API_BASE}/users/{h['userId']}/scheduling-precision",
            json={"precision": p}, timeout=20,
        )
        r.raise_for_status()
        assert r.json()["schedulingPrecision"] == p


def test_invalid_precision_rejected():
    h, _ = _create_household()
    r = requests.patch(
        f"{API_BASE}/users/{h['userId']}/scheduling-precision",
        json={"precision": "magic"}, timeout=20,
    )
    assert r.status_code == 400


def test_precision_scheduled_block_stamps_start_and_end():
    """When precision = scheduled_block, assigned tasks must carry scheduledStart and scheduledEnd."""
    h, _ = _create_household(creator_avail=avail("08:00", "22:00"))
    requests.patch(
        f"{API_BASE}/users/{h['userId']}/scheduling-precision",
        json={"precision": "scheduled_block"}, timeout=20,
    ).raise_for_status()
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    tasks = _tasks_for(h["householdId"], h["userId"])
    assert tasks, "expected tasks assigned"
    # At least one task should have scheduledStart + scheduledEnd
    scheduled = [t for t in tasks if t.get("scheduledStart") and t.get("scheduledEnd")]
    assert scheduled, f"no scheduled times stamped on {[(t['title'], t.get('scheduledStart')) for t in tasks]}"
    # Times should fall inside the availability window 08:00–22:00
    for t in scheduled[:5]:
        sh, sm = map(int, t["scheduledStart"].split(":"))
        assert 8 <= sh < 22, f"start {t['scheduledStart']} outside 08-22 window"


def test_precision_flexible_does_not_stamp_times():
    h, _ = _create_household(creator_avail=avail("08:00", "22:00"))
    # default precision is flexible — assign and confirm no scheduledStart
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    tasks = _tasks_for(h["householdId"], h["userId"])
    assert tasks, "expected tasks"
    stamped = [t for t in tasks if t.get("scheduledStart")]
    assert not stamped, "flexible precision should not stamp scheduledStart"


def test_precision_precision_uses_15min_grain():
    h, _ = _create_household(creator_avail=avail("08:00", "22:00"))
    requests.patch(
        f"{API_BASE}/users/{h['userId']}/scheduling-precision",
        json={"precision": "precision"}, timeout=20,
    ).raise_for_status()
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    tasks = _tasks_for(h["householdId"], h["userId"])
    scheduled = [t["scheduledStart"] for t in tasks if t.get("scheduledStart")]
    assert scheduled, "expected scheduled tasks"
    for ts in scheduled:
        _, mm = ts.split(":")
        assert int(mm) % 15 == 0, f"precision should be 15-min grain, got {ts}"


# =====================================================
# 3. Capacity-aware distribution
# =====================================================
def test_unavailable_member_gets_no_chores():
    """If a member has the day disabled, they should not be assigned any tasks."""
    today = datetime.date.today().strftime("%A")
    busy = avail()
    busy[today]["enabled"] = False
    free = avail()
    h, members = _create_household(
        creator_avail=free,
        member_avails=[busy],  # this member is unavailable today
    )
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    busy_member = members[1]
    busy_tasks = _tasks_for(h["householdId"], busy_member["userId"])
    assert busy_tasks == [], f"busy member got tasks: {[t['title'] for t in busy_tasks]}"


def test_capacity_engine_respects_short_windows():
    """A member with a tiny window (60 minutes) should receive far fewer chores than one with a full day."""
    h, members = _create_household(
        creator_avail=avail("09:00", "10:00"),         # 60 min window → ~51 capacity min
        member_avails=[avail("08:00", "22:00")],       # full day
    )
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    admin_tasks = _tasks_for(h["householdId"], h["userId"])
    free_tasks = _tasks_for(h["householdId"], members[1]["userId"])
    # The full-day member must have strictly more tasks than the 60-min-window admin
    assert len(free_tasks) > len(admin_tasks), \
        f"Expected full-day member to receive more chores. Admin={len(admin_tasks)}, Free={len(free_tasks)}"


def test_total_task_minutes_within_capacity_budget():
    """A member with a small window should receive far less work than a full-day member.
    Per spec: the engine NEVER refuses work (overflow allowed), but should prefer the available member."""
    h, members = _create_household(
        creator_avail=avail("18:00", "21:00"),         # 3 hours = 153 capacity min
        member_avails=[avail("08:00", "22:00")],
    )
    requests.post(
        f"{API_BASE}/households/{h['householdId']}/assign-chores",
        params={"admin_user_id": h["userId"]}, timeout=30,
    ).raise_for_status()
    admin_min = sum(int(t.get("time_estimate", 15) or 15) for t in _tasks_for(h["householdId"], h["userId"]))
    free_min = sum(int(t.get("time_estimate", 15) or 15) for t in _tasks_for(h["householdId"], members[1]["userId"]))
    # The free member should carry meaningfully more work than the constrained admin
    assert free_min > admin_min * 1.5, \
        f"Expected free member to do >50% more work. admin={admin_min}min, free={free_min}min"
