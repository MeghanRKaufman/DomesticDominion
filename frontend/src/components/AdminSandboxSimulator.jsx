import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const cloneAvailability = (availability) => JSON.parse(JSON.stringify(availability || { weekly: {}, overrides: {} }));

export const AdminSandboxSimulator = ({ apiBase, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [sandbox, setSandbox] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState({ weekly: {}, overrides: {} });
  const [createForm, setCreateForm] = useState({ householdName: 'Mock Kingdom Simulator', playerCount: 4 });

  const selectedPlayer = useMemo(
    () => sandbox?.players?.find((player) => player.playerId === selectedPlayerId) || sandbox?.players?.[0] || null,
    [sandbox, selectedPlayerId]
  );

  const applySandbox = (payload) => {
    const nextSandbox = payload?.sandbox || payload || null;
    setSandbox(nextSandbox);
    if (nextSandbox?.players?.length) {
      const nextPlayerId = nextSandbox.players.some((player) => player.playerId === selectedPlayerId)
        ? selectedPlayerId
        : nextSandbox.players[0].playerId;
      setSelectedPlayerId(nextPlayerId);
      const nextPlayer = nextSandbox.players.find((player) => player.playerId === nextPlayerId) || nextSandbox.players[0];
      setScheduleDraft(cloneAvailability(nextPlayer?.preferences?.availability));
    }
  };

  const loadLatestSandbox = async () => {
    if (!currentUser?.userId) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBase}/sandbox-households/admin/${currentUser.userId}`);
      applySandbox(response.data.sandbox ? response.data : { sandbox: null });
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load sandbox simulator.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatestSandbox();
  }, [currentUser?.userId]);

  useEffect(() => {
    if (selectedPlayer?.preferences?.availability) {
      setScheduleDraft(cloneAvailability(selectedPlayer.preferences.availability));
      setNoteDraft('');
    }
  }, [selectedPlayerId, sandbox?.sandboxId]);

  const postAndRefresh = async (request) => {
    setActing(true);
    setError('');
    try {
      const response = await request();
      applySandbox(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Sandbox action failed.');
    } finally {
      setActing(false);
    }
  };

  const createSandbox = async () => {
    setCreating(true);
    setError('');
    try {
      const response = await axios.post(`${apiBase}/sandbox-households`, {
        adminUserId: currentUser.userId,
        householdName: createForm.householdName,
        playerCount: Number(createForm.playerCount),
      });
      applySandbox(response.data);
    } catch (createError) {
      setError(createError.response?.data?.detail || 'Could not create sandbox household.');
    } finally {
      setCreating(false);
    }
  };

  const updateScheduleDraft = (day, patch) => {
    setScheduleDraft((prev) => ({
      ...prev,
      weekly: {
        ...prev.weekly,
        [day]: {
          ...(prev.weekly?.[day] || {}),
          ...patch,
        },
      },
    }));
  };

  if (loading) {
    return (
      <Card data-testid="sandbox-simulator-loading-card">
        <CardContent className="py-10 text-center text-sm text-gray-500">Loading sandbox simulator…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="sandbox-simulator-panel">
      <Card className="border-2 border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-3xl">Sandbox Sim Mode</CardTitle>
          <p className="text-sm text-gray-600">
            Build a mock household, inspect the whole house from above, and then click into each player to preview their choices.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="sandbox-simulator-error">
              {error}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="sandbox-household-name">Sandbox household name</Label>
                <Input
                  id="sandbox-household-name"
                  value={createForm.householdName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, householdName: event.target.value }))}
                  data-testid="sandbox-household-name-input"
                />
              </div>
              <div>
                <Label htmlFor="sandbox-player-count">Player count</Label>
                <Input
                  id="sandbox-player-count"
                  type="number"
                  min="2"
                  max="8"
                  value={createForm.playerCount}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, playerCount: event.target.value }))}
                  data-testid="sandbox-player-count-input"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:w-[220px]">
              <Button
                onClick={createSandbox}
                disabled={creating}
                className="bg-sky-600 hover:bg-sky-700"
                data-testid="sandbox-create-button"
              >
                {creating ? 'Creating sandbox…' : sandbox ? 'Create fresh sandbox' : 'Create sandbox'}
              </Button>
              {sandbox && (
                <Button
                  variant="outline"
                  onClick={loadLatestSandbox}
                  data-testid="sandbox-refresh-button"
                >
                  Refresh sandbox
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!sandbox || !sandbox.metrics ? (
        <Card data-testid="sandbox-empty-state-card">
          <CardContent className="py-12 text-center text-gray-500">
            Create a sandbox household to see the aerial dashboard, switch between players, and test fake endorsement rewards.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              ['Players', sandbox.metrics?.playerCount ?? 0],
              ['Tasks', sandbox.metrics?.taskCount ?? 0],
              ['Completed', sandbox.metrics?.completedTasks ?? 0],
              ['Active Events', sandbox.metrics?.activeEvents ?? 0],
              ['Rewards', sandbox.metrics?.availableRewards ?? 0],
            ].map(([label, value]) => (
              <Card key={label} data-testid={`sandbox-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardContent className="pt-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border border-indigo-200 bg-indigo-50/60" data-testid="sandbox-theme-banner">
            <CardContent className="flex flex-col gap-2 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-500">Aerial view theme</p>
                <h3 className="text-2xl font-bold text-indigo-950">{sandbox.householdName}</h3>
                <p className="text-sm text-indigo-700">Daily observance theme: {sandbox.dailyTheme}</p>
              </div>
              {selectedPlayer && (
                <Button
                  variant="outline"
                  onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/generate-event`, { playerId: selectedPlayer.playerId }))}
                  disabled={acting}
                  data-testid="sandbox-generate-event-button"
                >
                  Trigger mission for {selectedPlayer.displayName}
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Household aerial dashboard</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {sandbox.players.map((player) => (
                    <button
                      key={player.playerId}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.playerId)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedPlayer?.playerId === player.playerId
                          ? 'border-sky-500 bg-sky-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/40'
                      }`}
                      data-testid={`sandbox-player-card-${player.playerId}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{player.displayName}</h3>
                          <p className="text-sm text-gray-500">Level {player.level} • {player.points} XP</p>
                        </div>
                        <Badge className={player.availableNow ? 'bg-emerald-600' : 'bg-gray-500'}>
                          {player.availableNow ? 'Available now' : 'Unavailable now'}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-gray-50 px-3 py-2" data-testid={`sandbox-player-pending-${player.playerId}`}>
                          Pending chores: <span className="font-semibold">{player.pendingTasks}</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2" data-testid={`sandbox-player-events-${player.playerId}`}>
                          Secret missions: <span className="font-semibold">{player.events.filter((event) => event.status === 'active').length}</span>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">Refused: <span className="font-semibold">{player.refusedTasks}</span></div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">Missed: <span className="font-semibold">{player.missedTasks}</span></div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">Notes: <span className="font-semibold">{player.notes.length}</span></div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2">Events done: <span className="font-semibold">{player.stats.eventsCompleted}</span></div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {selectedPlayer && (
                <Card data-testid="sandbox-player-perspective-card">
                  <CardHeader>
                    <CardTitle className="text-2xl">Playing as {selectedPlayer.displayName}</CardTitle>
                    <p className="text-sm text-gray-600">
                      Use this panel to accept or deny chores, dismiss missions, change schedule, and write notes from this player’s perspective.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold">Assigned chores</h4>
                          <Badge variant="outline">{selectedPlayer.pendingTasks} pending</Badge>
                        </div>
                        {selectedPlayer.tasks.length > 0 ? selectedPlayer.tasks.map((task) => (
                          <div key={task.taskId} className="rounded-2xl border border-gray-200 p-4" data-testid={`sandbox-task-${task.taskId}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-900">{task.title}</p>
                                <p className="text-sm text-gray-500">{task.room} • {task.difficulty} • +{task.basePoints} XP</p>
                                {task.scheduledWindow && (
                                  <p className="mt-1 text-xs text-gray-500">Window: {task.scheduledWindow.start} - {task.scheduledWindow.end}</p>
                                )}
                              </div>
                              <Badge className={task.status === 'completed' ? 'bg-emerald-600' : task.status === 'pending' ? 'bg-sky-600' : 'bg-gray-500'}>
                                {task.status}
                              </Badge>
                            </div>
                            {task.status === 'pending' && (
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                <Button size="sm" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/tasks/${task.taskId}/action`, { action: 'complete' }))} disabled={acting} data-testid={`sandbox-task-complete-${task.taskId}`}>
                                  Complete
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/tasks/${task.taskId}/action`, { action: 'refuse' }))} disabled={acting} data-testid={`sandbox-task-refuse-${task.taskId}`}>
                                  Refuse
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/tasks/${task.taskId}/action`, { action: 'miss' }))} disabled={acting} data-testid={`sandbox-task-miss-${task.taskId}`}>
                                  Miss
                                </Button>
                              </div>
                            )}
                          </div>
                        )) : (
                          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">No chores assigned to this player.</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold">Secret missions</h4>
                          <Badge variant="outline">{selectedPlayer.events.length}</Badge>
                        </div>
                        {selectedPlayer.events.length > 0 ? selectedPlayer.events.map((event) => (
                          <div key={event.eventId} className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" data-testid={`sandbox-event-${event.eventId}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-emerald-950">{event.title}</p>
                                <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">{event.themeName}</p>
                              </div>
                              <Badge className={event.userStatus === 'accepted' ? 'bg-emerald-600' : event.userStatus === 'completed' ? 'bg-sky-600' : 'bg-gray-600'}>
                                {event.userStatus}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm text-emerald-900">{event.description}</p>
                            <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-sm text-emerald-900">{event.completionHint}</div>
                            {['pending', 'accepted'].includes(event.userStatus) && event.status === 'active' && (
                              <div className="mt-4 grid grid-cols-3 gap-2">
                                {event.userStatus === 'pending' ? (
                                  <>
                                    <Button size="sm" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/events/${event.eventId}/action`, { action: 'accept' }))} disabled={acting} data-testid={`sandbox-event-accept-${event.eventId}`}>
                                      Accept
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/events/${event.eventId}/action`, { action: 'dismiss' }))} disabled={acting} data-testid={`sandbox-event-dismiss-${event.eventId}`}>
                                      Dismiss
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" className="col-span-2" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/events/${event.eventId}/action`, { action: 'complete' }))} disabled={acting} data-testid={`sandbox-event-complete-${event.eventId}`}>
                                    Complete mission
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )) : (
                          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-500">No secret missions assigned to this player right now.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold">Schedule editor</h4>
                          {selectedPlayer.todayWindow && (
                            <Badge variant="outline">Today: {selectedPlayer.todayWindow.start} - {selectedPlayer.todayWindow.end}</Badge>
                          )}
                        </div>
                        <div className="space-y-2 rounded-2xl border border-gray-200 p-4">
                          {DAY_ORDER.map((day) => {
                            const window = scheduleDraft?.weekly?.[day] || { enabled: false, start: '09:00', end: '17:00' };
                            return (
                              <div key={day} className="grid gap-2 md:grid-cols-[120px_84px_1fr_1fr] md:items-center" data-testid={`sandbox-schedule-row-${day.toLowerCase()}`}>
                                <span className="font-medium text-gray-800">{day}</span>
                                <label className="flex items-center gap-2 text-sm text-gray-600">
                                  <input type="checkbox" checked={window.enabled} onChange={(event) => updateScheduleDraft(day, { enabled: event.target.checked })} />
                                  Active
                                </label>
                                <Input type="time" value={window.start} disabled={!window.enabled} onChange={(event) => updateScheduleDraft(day, { start: event.target.value })} data-testid={`sandbox-schedule-start-${day.toLowerCase()}`} />
                                <Input type="time" value={window.end} disabled={!window.enabled} onChange={(event) => updateScheduleDraft(day, { end: event.target.value })} data-testid={`sandbox-schedule-end-${day.toLowerCase()}`} />
                              </div>
                            );
                          })}
                          <Button variant="outline" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/schedule`, { availability: scheduleDraft }))} disabled={acting} data-testid="sandbox-save-schedule-button">
                            Save simulated schedule
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-lg font-bold">Write a note as this player</h4>
                        <div className="rounded-2xl border border-gray-200 p-4">
                          <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Example: I swapped my availability because of soccer practice." data-testid="sandbox-note-textarea" />
                          <Button className="mt-3" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/players/${selectedPlayer.playerId}/notes`, { message: noteDraft }))} disabled={acting || !noteDraft.trim()} data-testid="sandbox-save-note-button">
                            Save note
                          </Button>
                          <div className="mt-4 space-y-2">
                            {selectedPlayer.notes.slice(0, 4).map((note) => (
                              <div key={note.noteId} className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                <p>{note.message}</p>
                                <p className="mt-1 text-xs text-gray-400">{new Date(note.createdAt).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card data-testid="sandbox-endorsements-card">
                <CardHeader>
                  <CardTitle className="text-2xl">Mock endorsements</CardTitle>
                  <p className="text-sm text-gray-600">Coupon drops, shop offers, and achievement unlocks for future brand partnerships.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sandbox.endorsements.map((reward) => {
                    const claimable = reward.status === 'available' && (!reward.targetPlayerId || reward.targetPlayerId === selectedPlayer?.playerId);
                    return (
                      <div key={reward.rewardId} className="rounded-2xl border border-gray-200 p-4" data-testid={`sandbox-reward-${reward.rewardId}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">{reward.businessName}</p>
                            <p className="text-sm text-gray-600">{reward.title}</p>
                          </div>
                          <Badge className={reward.rewardType === 'coupon_drop' ? 'bg-orange-500' : reward.rewardType === 'shop_offer' ? 'bg-indigo-600' : 'bg-emerald-600'}>
                            {reward.rewardType.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-3 text-sm text-gray-700">{reward.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>Target: {reward.targetPlayerName}</span>
                          <span>Status: {reward.status}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{reward.code}</span>
                          {claimable && selectedPlayer && (
                            <Button size="sm" variant="outline" onClick={() => postAndRefresh(() => axios.post(`${apiBase}/sandbox-households/${sandbox.sandboxId}/endorsements/${reward.rewardId}/claim`, { playerId: selectedPlayer.playerId }))} disabled={acting} data-testid={`sandbox-claim-reward-${reward.rewardId}`}>
                              Claim as {selectedPlayer.displayName}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card data-testid="sandbox-activity-feed-card">
                <CardHeader>
                  <CardTitle className="text-2xl">Simulation activity feed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sandbox.activityFeed.length > 0 ? sandbox.activityFeed.map((entry) => (
                    <div key={entry.activityId} className="rounded-2xl border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-900">{entry.actorName}</span>
                        <Badge variant="outline">{entry.category}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">{entry.message}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-500">No simulation actions yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
