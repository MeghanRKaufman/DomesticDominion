"""End-to-end tests for the Chore Swapping system."""
import datetime
import uuid

import pytest
import requests

API_BASE = "http://127.0.0.1:8001/api"
WEEKLY_ALWAYS_AVAILABLE = {
    day: {"enabled": True, "start": "00:00", "end": "23:59"}
    for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}


def _build_member_preferences():
    return {
        "availability": {"weekly": WEEKLY_ALWAYS_AVAILABLE, "overrides": {}},
        "choreAversions": [],
        "preferredTasks": [],
        "maxDailyChoreLoad": 6,
    }


def create_household_with_members(member_count=3):
    """Create a household with 1 admin + (member_count-1) members. Returns the list of user dicts (admin first)."""
    payload = {
        "householdName": f"Swap House {uuid.uuid4().hex[:6]}",
        "adminName": "Swap Admin",
        "householdType": "roommates",
        "memberLimit": max(member_count, 3),
        "householdSetup": {
            "rooms": {"bedrooms": member_count, "bathrooms": 1, "kitchen": True, "livingRoom": True},
            "laundryType": "in_unit",
            "dryingMethod": ["dryer"],
            "trashDays": ["Monday"],
            "pets": [],
            "vehicles": [],
            "availability": {"weekly": WEEKLY_ALWAYS_AVAILABLE, "overrides": {}},
            "choreAversions": [],
            "preferredTasks": [],
            "maxDailyChoreLoad": 6,
        },
    }
    created = requests.post(f"{API_BASE}/households/create-enhanced", json=payload, timeout=30).json()
    members = [created]
    for i in range(member_count - 1):
        joined = requests.post(
            f"{API_BASE}/households/join",
            json={
                "inviteCode": created["inviteCode"],
                "memberName": f"Swap Member {i+1}",
                "memberPreferences": _build_member_preferences(),
            },
            timeout=30,
        ).json()
        members.append(joined)
    assign = requests.post(
        f"{API_BASE}/households/{created['householdId']}/assign-chores",
        params={"admin_user_id": created["userId"]},
        timeout=30,
    )
    assign.raise_for_status()
    return created, members


def fetch_first_task_assigned_to(household_id, user_id):
    today = datetime.date.today().isoformat()
    resp = requests.get(
        f"{API_BASE}/households/{household_id}/my-tasks/{user_id}",
        params={"date": today},
        timeout=30,
    )
    resp.raise_for_status()
    tasks = [t for room_tasks in resp.json().values() for t in room_tasks]
    available = [t for t in tasks if not t.get("completed") and t.get("can_swap", True)]
    assert available, f"No swappable task found for user {user_id}"
    return available[0]


def test_trade_swap_happy_path():
    """A→B trade: requires target accept + admin approval. Both tasks reassign."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])
    member1_task = fetch_first_task_assigned_to(created["householdId"], member1["userId"])

    resp = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"],
        "taskId": admin_task["taskId"],
        "swapType": "trade",
        "targetId": member1["userId"],
        "offerTaskId": member1_task["taskId"],
    }, timeout=30)
    resp.raise_for_status()
    swap_id = resp.json()["swapId"]
    assert resp.json()["status"] == "pending_target"

    # Wrong responder
    bad = requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": swap_id, "userId": admin["userId"], "response": "accept",
    }, timeout=30)
    assert bad.status_code == 403

    # Target accepts → pending_admin
    accept = requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": swap_id, "userId": member1["userId"], "response": "accept",
    }, timeout=30)
    accept.raise_for_status()
    assert accept.json()["status"] == "pending_admin"

    # Non-admin can't approve
    not_admin = requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": swap_id, "adminUserId": member1["userId"], "approve": True,
    }, timeout=30)
    assert not_admin.status_code == 403

    # Admin approves → accepted
    approve = requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": swap_id, "adminUserId": admin["userId"], "approve": True,
    }, timeout=30)
    approve.raise_for_status()
    assert approve.json()["status"] == "accepted"

    # Both tasks reassigned
    today = datetime.date.today().isoformat()
    all_tasks = requests.get(
        f"{API_BASE}/tasks",
        params={"householdId": created["householdId"], "date": today},
        timeout=30,
    ).json()
    t1 = next(t for t in all_tasks if t["taskId"] == admin_task["taskId"])
    t2 = next(t for t in all_tasks if t["taskId"] == member1_task["taskId"])
    assert t1["assignedTo"] == member1["userId"]
    assert t2["assignedTo"] == admin["userId"]

    # Fairness counter incremented
    user_doc = requests.get(f"{API_BASE}/users/{admin['userId']}", timeout=30).json()
    assert user_doc.get("swapsInitiatedThisWeek", 0) >= 1


def test_give_swap_one_way_no_offer():
    """One-way give: no offer task needed."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    resp = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"],
        "taskId": admin_task["taskId"],
        "swapType": "give",
        "targetId": member1["userId"],
    }, timeout=30)
    resp.raise_for_status()
    swap_id = resp.json()["swapId"]

    requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": swap_id, "userId": member1["userId"], "response": "accept",
    }, timeout=30).raise_for_status()
    requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": swap_id, "adminUserId": admin["userId"], "approve": True,
    }, timeout=30).raise_for_status()

    tasks_after = requests.get(
        f"{API_BASE}/tasks",
        params={"householdId": created["householdId"], "date": datetime.date.today().isoformat()},
        timeout=30,
    ).json()
    t = next(x for x in tasks_after if x["taskId"] == admin_task["taskId"])
    assert t["assignedTo"] == member1["userId"]


def test_marketplace_flow():
    """Marketplace: post → another member claims → admin approves."""
    created, members = create_household_with_members(3)
    admin, m1, m2 = members[0], members[1], members[2]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    resp = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"],
        "taskId": admin_task["taskId"],
        "swapType": "marketplace",
    }, timeout=30)
    resp.raise_for_status()
    swap_id = resp.json()["swapId"]

    listing = requests.get(f"{API_BASE}/chore-swaps/marketplace/{created['householdId']}", timeout=30).json()
    assert any(s["swapId"] == swap_id for s in listing["marketplace"])

    # Requester cannot claim own post
    self_claim = requests.post(f"{API_BASE}/chore-swaps/claim", json={
        "swapId": swap_id, "userId": admin["userId"],
    }, timeout=30)
    assert self_claim.status_code == 400

    # m1 claims
    claim = requests.post(f"{API_BASE}/chore-swaps/claim", json={
        "swapId": swap_id, "userId": m1["userId"],
    }, timeout=30)
    claim.raise_for_status()
    assert claim.json()["status"] == "pending_admin"

    # m2 cannot claim once already pending_admin
    second_claim = requests.post(f"{API_BASE}/chore-swaps/claim", json={
        "swapId": swap_id, "userId": m2["userId"],
    }, timeout=30)
    assert second_claim.status_code == 400

    # Admin approves
    requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": swap_id, "adminUserId": admin["userId"], "approve": True,
    }, timeout=30).raise_for_status()

    tasks_after = requests.get(
        f"{API_BASE}/tasks",
        params={"householdId": created["householdId"], "date": datetime.date.today().isoformat()},
        timeout=30,
    ).json()
    t = next(x for x in tasks_after if x["taskId"] == admin_task["taskId"])
    assert t["assignedTo"] == m1["userId"]


def test_decline_and_admin_deny():
    """Decline path + admin deny path."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    # Decline path
    resp = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "give", "targetId": member1["userId"],
    }, timeout=30)
    resp.raise_for_status()
    swap_id = resp.json()["swapId"]
    decline = requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": swap_id, "userId": member1["userId"], "response": "decline",
        "declineReason": "Not today!",
    }, timeout=30)
    decline.raise_for_status()
    assert decline.json()["status"] == "declined"

    # Admin deny path — create a fresh swap on another task
    admin_tasks_today = requests.get(
        f"{API_BASE}/households/{created['householdId']}/my-tasks/{admin['userId']}",
        params={"date": datetime.date.today().isoformat()},
        timeout=30,
    ).json()
    flat = [t for tasks in admin_tasks_today.values() for t in tasks if not t.get("completed") and t["taskId"] != admin_task["taskId"]]
    assert flat, "Need another task for the admin"
    another = flat[0]
    resp2 = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": another["taskId"],
        "swapType": "give", "targetId": member1["userId"],
    }, timeout=30)
    resp2.raise_for_status()
    swap_id2 = resp2.json()["swapId"]
    requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": swap_id2, "userId": member1["userId"], "response": "accept",
    }, timeout=30).raise_for_status()
    deny = requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": swap_id2, "adminUserId": admin["userId"], "approve": False,
        "denyReason": "Not fair right now",
    }, timeout=30)
    deny.raise_for_status()
    assert deny.json()["status"] == "denied"

    # Task should still be on admin
    tasks_after = requests.get(
        f"{API_BASE}/tasks",
        params={"householdId": created["householdId"], "date": datetime.date.today().isoformat()},
        timeout=30,
    ).json()
    t = next(x for x in tasks_after if x["taskId"] == another["taskId"])
    assert t["assignedTo"] == admin["userId"]


def test_requester_cancel_and_pending_limit():
    """Requester can cancel; pending swap limit enforced."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]

    # Fetch up to 4 distinct tasks
    admin_tasks_today = requests.get(
        f"{API_BASE}/households/{created['householdId']}/my-tasks/{admin['userId']}",
        params={"date": datetime.date.today().isoformat()},
        timeout=30,
    ).json()
    flat = [t for tasks in admin_tasks_today.values() for t in tasks if not t.get("completed") and t.get("can_swap", True)]
    assert len(flat) >= 4, "Need at least 4 swappable tasks for the limit test"
    tasks = flat[:4]

    swap_ids = []
    for i in range(3):
        r = requests.post(f"{API_BASE}/chore-swaps/request", json={
            "requesterId": admin["userId"], "taskId": tasks[i]["taskId"],
            "swapType": "marketplace",
        }, timeout=30)
        r.raise_for_status()
        swap_ids.append(r.json()["swapId"])

    # 4th request should fail (limit = 3)
    fourth = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": tasks[3]["taskId"],
        "swapType": "marketplace",
    }, timeout=30)
    assert fourth.status_code == 400
    assert "maximum" in fourth.json()["detail"].lower()

    # Cancel one, then the 4th should succeed
    cancel = requests.post(f"{API_BASE}/chore-swaps/cancel", json={
        "swapId": swap_ids[0], "userId": admin["userId"],
    }, timeout=30)
    cancel.raise_for_status()

    retry = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": tasks[3]["taskId"],
        "swapType": "marketplace",
    }, timeout=30)
    retry.raise_for_status()


def test_cooldown_blocks_immediate_reswap():
    """After a swap is accepted, the same task can't be re-swapped immediately."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    # admin → member1 give swap, accept + approve
    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "give", "targetId": member1["userId"],
    }, timeout=30)
    r.raise_for_status()
    sid = r.json()["swapId"]
    requests.post(f"{API_BASE}/chore-swaps/respond", json={
        "swapId": sid, "userId": member1["userId"], "response": "accept",
    }, timeout=30).raise_for_status()
    requests.post(f"{API_BASE}/chore-swaps/admin-approve", json={
        "swapId": sid, "adminUserId": admin["userId"], "approve": True,
    }, timeout=30).raise_for_status()

    # Now member1 immediately tries to swap the same task back
    again = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": member1["userId"], "taskId": admin_task["taskId"],
        "swapType": "give", "targetId": admin["userId"],
    }, timeout=30)
    assert again.status_code == 400
    assert "cooldown" in again.json()["detail"].lower() or "swapped recently" in again.json()["detail"].lower()


def test_validation_errors():
    """Validation: self-swap, completed task, wrong household, missing target/offer."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    # Self-swap
    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "give", "targetId": admin["userId"],
    }, timeout=30)
    assert r.status_code == 400

    # Missing targetId on trade
    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "trade",
    }, timeout=30)
    assert r.status_code == 400

    # Missing offerTaskId on trade
    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "trade", "targetId": member1["userId"],
    }, timeout=30)
    assert r.status_code == 400

    # Invalid swapType
    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "bogus",
    }, timeout=30)
    assert r.status_code == 400


def test_user_swap_summary_endpoint():
    """GET /chore-swaps/user/{user_id} returns the right buckets."""
    created, members = create_household_with_members(2)
    admin, member1 = members[0], members[1]
    admin_task = fetch_first_task_assigned_to(created["householdId"], admin["userId"])

    r = requests.post(f"{API_BASE}/chore-swaps/request", json={
        "requesterId": admin["userId"], "taskId": admin_task["taskId"],
        "swapType": "give", "targetId": member1["userId"],
    }, timeout=30)
    r.raise_for_status()

    admin_view = requests.get(f"{API_BASE}/chore-swaps/user/{admin['userId']}", timeout=30).json()
    assert admin_view["isAdmin"] is True
    assert len(admin_view["outgoing"]) >= 1

    member_view = requests.get(f"{API_BASE}/chore-swaps/user/{member1['userId']}", timeout=30).json()
    assert member_view["isAdmin"] is False
    assert len(member_view["incoming"]) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
