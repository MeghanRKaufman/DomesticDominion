import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar } from './ui/calendar';
import { Switch } from './ui/switch';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const createFallbackWeeklyAvailability = () => ({
  Monday: { enabled: true, start: '18:00', end: '22:00' },
  Tuesday: { enabled: true, start: '18:00', end: '22:00' },
  Wednesday: { enabled: true, start: '18:00', end: '22:00' },
  Thursday: { enabled: true, start: '18:00', end: '22:00' },
  Friday: { enabled: true, start: '18:00', end: '22:00' },
  Saturday: { enabled: true, start: '09:00', end: '21:00' },
  Sunday: { enabled: true, start: '09:00', end: '21:00' },
});

const toDateKey = (value) => new Date(value).toISOString().split('T')[0];

const buildAvailabilityState = (preferences = {}) => ({
  ...preferences,
  availability: {
    weekly: {
      ...createFallbackWeeklyAvailability(),
      ...(preferences.availability?.weekly || {}),
    },
    overrides: preferences.availability?.overrides || {},
  },
});

export const AvailabilitySettingsPanel = ({ apiBase, currentUser, onUserUpdated, onCelebration }) => {
  const [preferences, setPreferences] = useState(buildAvailabilityState(currentUser?.preferences));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedDateKey = useMemo(() => toDateKey(selectedDate || new Date()), [selectedDate]);
  const selectedDayName = useMemo(
    () => new Date(`${selectedDateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    [selectedDateKey]
  );
  const selectedOverride = preferences.availability?.overrides?.[selectedDateKey] || null;
  const selectedWeeklyWindow =
    preferences.availability?.weekly?.[selectedDayName] || createFallbackWeeklyAvailability()[selectedDayName];

  const sortedOverrides = useMemo(
    () => Object.entries(preferences.availability?.overrides || {}).sort(([a], [b]) => a.localeCompare(b)),
    [preferences]
  );

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser?.userId) return;
      setLoading(true);
      setError('');
      try {
        const response = await axios.get(`${apiBase}/users/${currentUser.userId}`);
        const nextUser = response.data;
        onUserUpdated?.(nextUser);
        setPreferences(buildAvailabilityState(nextUser.preferences));
      } catch (loadError) {
        setError(loadError.response?.data?.detail || 'Could not load your availability settings.');
        setPreferences(buildAvailabilityState(currentUser?.preferences));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [apiBase, currentUser?.userId]);

  const updateWeeklyWindow = (day, patch) => {
    setPreferences((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        weekly: {
          ...prev.availability.weekly,
          [day]: {
            ...prev.availability.weekly[day],
            ...patch,
          },
        },
      },
    }));
  };

  const enableOverride = () => {
    setPreferences((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        overrides: {
          ...prev.availability.overrides,
          [selectedDateKey]: {
            ...selectedWeeklyWindow,
          },
        },
      },
    }));
  };

  const updateOverride = (patch) => {
    setPreferences((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        overrides: {
          ...prev.availability.overrides,
          [selectedDateKey]: {
            ...(prev.availability.overrides[selectedDateKey] || selectedWeeklyWindow),
            ...patch,
          },
        },
      },
    }));
  };

  const clearOverride = () => {
    setPreferences((prev) => {
      const nextOverrides = { ...prev.availability.overrides };
      delete nextOverrides[selectedDateKey];
      return {
        ...prev,
        availability: {
          ...prev.availability,
          overrides: nextOverrides,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!currentUser?.userId) return;
    setSaving(true);
    setError('');
    try {
      const response = await axios.post(`${apiBase}/users/${currentUser.userId}/preferences`, {
        userId: currentUser.userId,
        preferences,
      });
      const nextUser = {
        ...currentUser,
        preferences: response.data.preferences,
      };
      setPreferences(buildAvailabilityState(response.data.preferences));
      onUserUpdated?.(nextUser);
      onCelebration?.(response.data.message || 'Availability settings saved.');
    } catch (saveError) {
      setError(saveError.response?.data?.detail || 'Could not save availability settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card data-testid="availability-settings-loading-card">
        <CardContent className="py-10 text-center text-sm text-gray-500">Loading your schedule…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="availability-settings-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Availability Calendar</CardTitle>
          <p className="text-sm text-gray-600">
            Weekly defaults drive everyday chore assignment, and date overrides let you block off or customize a specific day.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="availability-settings-error">
              {error}
            </div>
          )}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700" data-testid="availability-settings-note">
            If quests are already assigned, saving here will redistribute them to fit your updated windows.
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="availability-settings-save-button"
          >
            {saving ? 'Saving schedule…' : 'Save availability'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Weekly defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAY_ORDER.map((day) => {
              const dayWindow = preferences.availability.weekly[day];
              return (
                <div
                  key={day}
                  className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[160px_80px_1fr_1fr] md:items-center"
                  data-testid={`availability-weekly-row-${day.toLowerCase()}`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{day}</p>
                    <p className="text-xs text-gray-500">Default window</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={dayWindow.enabled}
                      onCheckedChange={(checked) => updateWeeklyWindow(day, { enabled: checked })}
                      data-testid={`availability-weekly-enabled-${day.toLowerCase()}`}
                    />
                    <span className="text-sm text-gray-600">{dayWindow.enabled ? 'On' : 'Off'}</span>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Start</Label>
                    <Input
                      type="time"
                      value={dayWindow.start}
                      disabled={!dayWindow.enabled}
                      onChange={(event) => updateWeeklyWindow(day, { start: event.target.value })}
                      data-testid={`availability-weekly-start-${day.toLowerCase()}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">End</Label>
                    <Input
                      type="time"
                      value={dayWindow.end}
                      disabled={!dayWindow.enabled}
                      onChange={(event) => updateWeeklyWindow(day, { end: event.target.value })}
                      data-testid={`availability-weekly-end-${day.toLowerCase()}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Date overrides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-auto rounded-xl border border-gray-200">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(value) => value && setSelectedDate(value)}
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="availability-override-editor">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedDateKey}</p>
                    <p className="text-xs text-gray-500">{selectedDayName}</p>
                  </div>
                  {selectedOverride ? (
                    <Button variant="outline" onClick={clearOverride} data-testid="availability-clear-override-button">
                      Clear override
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={enableOverride} data-testid="availability-create-override-button">
                      Create override
                    </Button>
                  )}
                </div>

                {!selectedOverride ? (
                  <div className="space-y-2 text-sm text-gray-600" data-testid="availability-override-default-summary">
                    <p>Using weekly default for this date.</p>
                    <p>
                      {selectedWeeklyWindow.enabled
                        ? `${selectedWeeklyWindow.start} to ${selectedWeeklyWindow.end}`
                        : 'Unavailable all day'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">Available on this date</span>
                      <Switch
                        checked={selectedOverride.enabled}
                        onCheckedChange={(checked) => updateOverride({ enabled: checked })}
                        data-testid="availability-override-enabled-switch"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs text-gray-500">Start</Label>
                        <Input
                          type="time"
                          value={selectedOverride.start}
                          disabled={!selectedOverride.enabled}
                          onChange={(event) => updateOverride({ start: event.target.value })}
                          data-testid="availability-override-start-input"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">End</Label>
                        <Input
                          type="time"
                          value={selectedOverride.end}
                          disabled={!selectedOverride.enabled}
                          onChange={(event) => updateOverride({ end: event.target.value })}
                          data-testid="availability-override-end-input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Saved overrides</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedOverrides.length > 0 ? (
                <div className="space-y-2" data-testid="availability-saved-overrides-list">
                  {sortedOverrides.map(([dateKey, override]) => (
                    <div key={dateKey} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-900">{dateKey}</span>
                      <span className="text-gray-600">
                        {override.enabled ? `${override.start} to ${override.end}` : 'Unavailable'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500" data-testid="availability-saved-overrides-empty-state">
                  No date-specific overrides yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
