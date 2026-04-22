import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export const RandomEventBubble = ({ event, loading, onAccept, onDismiss, onComplete }) => {
  if (!event) {
    return null;
  }

  const isAccepted = event.userStatus === 'accepted';
  const participantLabel = event.participantCount > 1 ? `${event.participantCount} players` : 'Solo mission';

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)]" data-testid="random-event-bubble">
      <Card className="border-2 border-emerald-300 bg-white/95 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Secret Mission</p>
              <CardTitle className="text-xl leading-tight">{event.title}</CardTitle>
            </div>
            <Badge className="bg-emerald-600 text-white" data-testid="random-event-theme-badge">
              {event.themeName}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span data-testid="random-event-participant-label">{participantLabel}</span>
            <span>•</span>
            <span data-testid="random-event-xp-label">+{event.userXpReward} XP</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-gray-700" data-testid="random-event-description">
            {event.description}
          </p>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" data-testid="random-event-hint">
            {event.completionHint}
          </div>
          {isAccepted ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={onComplete}
              disabled={loading}
              data-testid="random-event-complete-button"
            >
              {loading ? 'Completing mission…' : 'Complete secret mission'}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={onAccept}
                disabled={loading}
                data-testid="random-event-accept-button"
              >
                {loading ? 'Working…' : 'Accept'}
              </Button>
              <Button
                variant="outline"
                onClick={onDismiss}
                disabled={loading}
                data-testid="random-event-dismiss-button"
              >
                Not now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
