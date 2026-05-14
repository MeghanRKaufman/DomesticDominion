import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const STATUS_LABEL = {
  pending_target: 'Waiting on target',
  pending_admin: 'Waiting on admin',
  accepted: 'Completed',
  declined: 'Declined',
  denied: 'Denied by admin',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_COLOR = {
  pending_target: 'bg-amber-100 text-amber-800',
  pending_admin: 'bg-violet-100 text-violet-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-rose-100 text-rose-800',
  denied: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};

const TYPE_BADGE = {
  trade: '🔁 Trade',
  give: '🎁 Give',
  marketplace: '🏪 Marketplace',
};

function flattenTasks(tasksObj) {
  if (!tasksObj) return [];
  if (Array.isArray(tasksObj)) return tasksObj;
  return Object.values(tasksObj).reduce((acc, list) => acc.concat(list || []), []);
}

export function ChoreSwapPanel({ apiBase, currentUser, householdMembers, myTasks, onAfterChange }) {
  const [summary, setSummary] = useState(null);
  const [marketplace, setMarketplace] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    swapType: 'trade',
    taskId: '',
    targetId: '',
    offerTaskId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [memberTaskCache, setMemberTaskCache] = useState({});

  const myTaskList = useMemo(() => flattenTasks(myTasks).filter((t) => !t?.completed && t?.can_swap !== false), [myTasks]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const teammates = useMemo(
    () => (householdMembers || []).filter((m) => m.userId !== currentUser?.userId),
    [householdMembers, currentUser]
  );

  const refresh = useCallback(async () => {
    if (!currentUser?.userId || !currentUser?.householdId) return;
    setLoading(true);
    setError('');
    try {
      const [sumRes, mktRes] = await Promise.all([
        axios.get(`${apiBase}/chore-swaps/user/${currentUser.userId}`),
        axios.get(`${apiBase}/chore-swaps/marketplace/${currentUser.householdId}`),
      ]);
      setSummary(sumRes.data);
      setMarketplace(mktRes.data.marketplace || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Failed to load swaps');
    } finally {
      setLoading(false);
    }
  }, [apiBase, currentUser]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 12000);
    return () => clearInterval(id);
  }, [refresh]);

  const loadMemberTasks = useCallback(
    async (memberId) => {
      if (!memberId || !currentUser?.householdId) return [];
      if (memberTaskCache[memberId]) return memberTaskCache[memberId];
      try {
        const res = await axios.get(`${apiBase}/households/${currentUser.householdId}/my-tasks/${memberId}`, {
          params: { date: today },
        });
        const tasks = flattenTasks(res.data).filter((t) => !t.completed && t.can_swap !== false);
        setMemberTaskCache((prev) => ({ ...prev, [memberId]: tasks }));
        return tasks;
      } catch {
        return [];
      }
    },
    [apiBase, currentUser, memberTaskCache, today]
  );

  useEffect(() => {
    if (form.swapType === 'trade' && form.targetId) {
      loadMemberTasks(form.targetId);
    }
  }, [form.swapType, form.targetId, loadMemberTasks]);

  const submitSwap = async () => {
    if (!form.taskId) {
      setError('Pick one of your chores to swap.');
      return;
    }
    if ((form.swapType === 'trade' || form.swapType === 'give') && !form.targetId) {
      setError('Pick a household member to send the request to.');
      return;
    }
    if (form.swapType === 'trade' && !form.offerTaskId) {
      setError('Pick which of their chores you want in exchange.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${apiBase}/chore-swaps/request`, {
        requesterId: currentUser.userId,
        taskId: form.taskId,
        swapType: form.swapType,
        targetId: form.swapType === 'marketplace' ? null : form.targetId,
        offerTaskId: form.swapType === 'trade' ? form.offerTaskId : null,
      });
      setShowCreate(false);
      setForm({ swapType: 'trade', taskId: '', targetId: '', offerTaskId: '' });
      await refresh();
      if (onAfterChange) onAfterChange();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to create swap');
    } finally {
      setSubmitting(false);
    }
  };

  const respond = async (swapId, response) => {
    setError('');
    try {
      await axios.post(`${apiBase}/chore-swaps/respond`, {
        swapId,
        userId: currentUser.userId,
        response,
      });
      await refresh();
      if (onAfterChange) onAfterChange();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to respond');
    }
  };

  const adminDecide = async (swapId, approve) => {
    setError('');
    try {
      await axios.post(`${apiBase}/chore-swaps/admin-approve`, {
        swapId,
        adminUserId: currentUser.userId,
        approve,
      });
      await refresh();
      if (onAfterChange) onAfterChange();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to update swap');
    }
  };

  const cancel = async (swapId) => {
    setError('');
    try {
      await axios.post(`${apiBase}/chore-swaps/cancel`, {
        swapId,
        userId: currentUser.userId,
      });
      await refresh();
      if (onAfterChange) onAfterChange();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to cancel');
    }
  };

  const claim = async (swapId) => {
    setError('');
    try {
      await axios.post(`${apiBase}/chore-swaps/claim`, {
        swapId,
        userId: currentUser.userId,
      });
      await refresh();
      if (onAfterChange) onAfterChange();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to claim');
    }
  };

  const incoming = summary?.incoming || [];
  const outgoing = summary?.outgoing || [];
  const adminQueue = summary?.adminQueue || [];
  const history = summary?.history || [];
  const isAdmin = !!summary?.isAdmin;
  const limits = summary?.limits || { maxPendingPerUser: 3, cooldownHours: 12 };

  return (
    <div className="space-y-6" data-testid="chore-swap-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">🔁 Chore Swap Exchange</h2>
          <p className="text-gray-600 mt-1 text-sm">
            Trade, gift, or post chores to the open marketplace. Limit: {limits.maxPendingPerUser} active per player ·
            {' '}{limits.cooldownHours}h cooldown after each accepted swap.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          data-testid="chore-swap-new-button"
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition"
        >
          {showCreate ? 'Close' : '➕ New Swap'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm" data-testid="chore-swap-error">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm space-y-4" data-testid="chore-swap-create-form">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['trade', 'give', 'marketplace'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, swapType: t, targetId: t === 'marketplace' ? '' : f.targetId, offerTaskId: '' }))}
                data-testid={`chore-swap-type-${t}`}
                className={`p-4 rounded-xl border-2 text-left ${
                  form.swapType === t ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-lg font-semibold">{TYPE_BADGE[t]}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {t === 'trade' && 'Offer one of your chores for one of theirs.'}
                  {t === 'give' && 'One-way: gift a chore to a specific player.'}
                  {t === 'marketplace' && 'Post it for any housemate to claim.'}
                </div>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">My chore to swap</label>
            <select
              data-testid="chore-swap-task-select"
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              value={form.taskId}
              onChange={(e) => setForm((f) => ({ ...f, taskId: e.target.value }))}
            >
              <option value="">— Select one of your chores —</option>
              {myTaskList.map((t) => (
                <option key={t.taskId} value={t.taskId}>
                  {t.title} {t.room ? `(${t.room})` : ''}
                </option>
              ))}
            </select>
          </div>

          {form.swapType !== 'marketplace' && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Target housemate</label>
              <select
                data-testid="chore-swap-target-select"
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value, offerTaskId: '' }))}
              >
                <option value="">— Select a housemate —</option>
                {teammates.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.swapType === 'trade' && form.targetId && (
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Their chore to take</label>
              <select
                data-testid="chore-swap-offer-select"
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
                value={form.offerTaskId}
                onChange={(e) => setForm((f) => ({ ...f, offerTaskId: e.target.value }))}
              >
                <option value="">— Select one of their chores —</option>
                {(memberTaskCache[form.targetId] || []).map((t) => (
                  <option key={t.taskId} value={t.taskId}>
                    {t.title} {t.room ? `(${t.room})` : ''}
                  </option>
                ))}
              </select>
              {(memberTaskCache[form.targetId] || []).length === 0 && (
                <p className="text-xs text-gray-500 mt-1">They have no swappable chores today.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={submitSwap}
              data-testid="chore-swap-submit-button"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send Swap'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SwapList
          title="📥 Incoming Requests"
          items={incoming}
          emptyText="No incoming swap requests."
          currentUser={currentUser}
          renderActions={(swap) => (
            <div className="flex gap-2">
              <button
                onClick={() => respond(swap.swapId, 'accept')}
                data-testid={`chore-swap-accept-${swap.swapId}`}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700"
              >
                Accept
              </button>
              <button
                onClick={() => respond(swap.swapId, 'decline')}
                data-testid={`chore-swap-decline-${swap.swapId}`}
                className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-md text-sm font-medium hover:bg-rose-200"
              >
                Decline
              </button>
            </div>
          )}
        />

        <SwapList
          title="📤 My Outgoing Requests"
          items={outgoing}
          emptyText="You haven't sent any swaps lately."
          currentUser={currentUser}
          renderActions={(swap) => (
            <button
              onClick={() => cancel(swap.swapId)}
              data-testid={`chore-swap-cancel-${swap.swapId}`}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          )}
        />

        <SwapList
          title="🏪 Open Marketplace"
          items={marketplace}
          emptyText="No open marketplace posts right now."
          currentUser={currentUser}
          renderActions={(swap) =>
            swap.requesterId === currentUser?.userId ? (
              <button
                onClick={() => cancel(swap.swapId)}
                data-testid={`chore-swap-mkt-cancel-${swap.swapId}`}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => claim(swap.swapId)}
                data-testid={`chore-swap-claim-${swap.swapId}`}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                Claim
              </button>
            )
          }
        />

        {isAdmin && (
          <SwapList
            title="🛡️ Admin Approval Queue"
            items={adminQueue}
            emptyText="No swaps waiting for your approval."
            currentUser={currentUser}
            renderActions={(swap) => (
              <div className="flex gap-2">
                <button
                  onClick={() => adminDecide(swap.swapId, true)}
                  data-testid={`chore-swap-admin-approve-${swap.swapId}`}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => adminDecide(swap.swapId, false)}
                  data-testid={`chore-swap-admin-deny-${swap.swapId}`}
                  className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-md text-sm font-medium hover:bg-rose-200"
                >
                  Deny
                </button>
              </div>
            )}
          />
        )}
      </div>

      {history.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
          <ul className="divide-y divide-gray-100 text-sm">
            {history.map((swap) => (
              <li key={swap.swapId} className="py-2 flex justify-between items-center" data-testid={`chore-swap-history-${swap.swapId}`}>
                <div>
                  <span className="font-medium">{swap.requesterName}</span> · {TYPE_BADGE[swap.swapType] || swap.swapType} · {swap.taskTitle}
                  {swap.offerTaskTitle ? ` ⇄ ${swap.offerTaskTitle}` : ''}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLOR[swap.status] || ''}`}>
                  {STATUS_LABEL[swap.status] || swap.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p className="text-center text-gray-400 text-sm">Loading swaps…</p>}
    </div>
  );
}

function SwapList({ title, items, emptyText, renderActions }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((swap) => (
            <li key={swap.swapId} className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2" data-testid={`chore-swap-card-${swap.swapId}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                      {TYPE_BADGE[swap.swapType] || swap.swapType}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[swap.status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABEL[swap.status] || swap.status}
                    </span>
                  </div>
                  <div className="font-medium">
                    {swap.requesterName} → {swap.targetName || swap.claimedByName || 'Marketplace'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {swap.taskTitle}
                    {swap.offerTaskTitle ? <> &nbsp;⇄&nbsp; {swap.offerTaskTitle}</> : null}
                  </div>
                </div>
                {renderActions && renderActions(swap)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ChoreSwapPanel;
