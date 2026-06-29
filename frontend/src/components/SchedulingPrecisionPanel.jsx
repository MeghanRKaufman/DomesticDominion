import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PRECISIONS = [
  { key: 'flexible',         label: 'Flexible',         sub: "Complete anytime today. No schedule." },
  { key: 'time_window',      label: 'Time Window',      sub: "Show a ~4-hour window per chore." },
  { key: 'suggested_time',   label: 'Suggested Time',   sub: "Hourly start times (e.g. 14:00)." },
  { key: 'scheduled_block',  label: 'Scheduled Block',  sub: "Start + end time per chore (calendar style)." },
  { key: 'precision',        label: 'Precision · 15-min', sub: "Tightly planned 15-minute slots." },
];

export function SchedulingPrecisionPanel({ apiBase, currentUser, onChanged }) {
  const [precision, setPrecision] = useState(currentUser?.schedulingPrecision || 'flexible');
  const [capacity, setCapacity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!currentUser?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [u, c] = await Promise.all([
          axios.get(`${apiBase}/users/${currentUser.userId}`),
          axios.get(`${apiBase}/users/${currentUser.userId}/capacity`),
        ]);
        if (cancelled) return;
        setPrecision(u.data.schedulingPrecision || 'flexible');
        setCapacity(c.data);
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [apiBase, currentUser]);

  const save = async (next) => {
    setSaving(true);
    setStatus('');
    try {
      await axios.patch(`${apiBase}/users/${currentUser.userId}/scheduling-precision`, { precision: next });
      setPrecision(next);
      setStatus(`Set to "${PRECISIONS.find(p => p.key === next)?.label}"`);
      if (onChanged) onChanged(next);
      setTimeout(() => setStatus(''), 2200);
    } catch (e) {
      setStatus(e?.response?.data?.detail || 'Could not update precision');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser?.userId) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mt-6" data-testid="scheduling-precision-panel">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">🧠 Scheduling Precision</h3>
          <p className="text-sm text-gray-600 mt-1">
            How precisely the Dynamic Capacity Engine schedules your chores. The system always estimates your daily capacity
            from your availability — pick how visible you want that schedule to be.
          </p>
        </div>
      </div>

      {capacity && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 text-sm" data-testid="capacity-summary">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-indigo-700">
              {Math.round(capacity.capacityMinutes / 60 * 10) / 10}h
            </span>
            <span className="text-indigo-600">today's capacity</span>
            <span className="text-gray-500 text-xs">
              · {capacity.committedMinutes} min committed · {capacity.remainingMinutes} min remaining
            </span>
          </div>
          {capacity.availabilityWindow && (
            <p className="text-xs text-gray-600 mt-1">
              Window: {capacity.availabilityWindow.start}–{capacity.availabilityWindow.end} ({capacity.availabilityWindow.day})
            </p>
          )}
          {!capacity.isChoreParticipant && (
            <p className="text-xs text-amber-700 mt-1">You're an external supervisor — chores aren't assigned to you.</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PRECISIONS.map(p => {
          const active = precision === p.key;
          return (
            <button
              key={p.key}
              type="button"
              data-testid={`precision-${p.key}`}
              disabled={saving}
              onClick={() => save(p.key)}
              className={`text-left rounded-xl border-2 p-4 transition ${
                active ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">{p.label}</span>
                {active && <span className="text-xs text-indigo-700 font-bold">CURRENT</span>}
              </div>
              <p className="text-xs text-gray-600">{p.sub}</p>
            </button>
          );
        })}
      </div>

      {status && <div className="mt-3 text-sm text-emerald-700" data-testid="precision-status">{status}</div>}
    </div>
  );
}

export default SchedulingPrecisionPanel;
