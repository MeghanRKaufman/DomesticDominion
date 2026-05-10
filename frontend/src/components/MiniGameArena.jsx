import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

const GAME_OPTIONS = [
  { value: 'rock_paper_scissors', label: 'Rock • Paper • Scissors' },
  { value: 'trivia', label: 'Trivia Duel' },
  { value: 'simon', label: 'Simon Says Duel' },
  { value: 'whack_a_mole', label: 'Whack-a-Mole Duel' },
];

const RpsRound = ({ onSubmit, disabled }) => (
  <div className="grid grid-cols-3 gap-3" data-testid="duel-rps-round">
    {[
      ['rock', '🪨'],
      ['paper', '📄'],
      ['scissors', '✂️'],
    ].map(([move, icon]) => (
      <Button key={move} disabled={disabled} onClick={() => onSubmit({ move })} data-testid={`duel-rps-${move}-button`}>
        <span className="mr-2 text-xl">{icon}</span>{move}
      </Button>
    ))}
  </div>
);

const TriviaRound = ({ roundState, onSubmit, disabled }) => {
  const [startTime] = useState(Date.now());
  return (
    <div className="space-y-4" data-testid="duel-trivia-round">
      <p className="text-lg font-semibold text-gray-900">{roundState?.promptData?.question}</p>
      <div className="grid gap-3">
        {(roundState?.promptData?.options || []).map((option, index) => (
          <Button
            key={option}
            variant="outline"
            disabled={disabled}
            onClick={() => onSubmit({ answerIndex: index, durationMs: Date.now() - startTime })}
            className="justify-start whitespace-normal text-left"
            data-testid={`duel-trivia-option-${index}`}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
};

const SimonRound = ({ roundState, onSubmit, disabled }) => {
  const [phase, setPhase] = useState('showing');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [progressIndex, setProgressIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const sequence = roundState?.promptData?.sequence || [];
  const colors = ['red', 'blue', 'green', 'yellow'];

  useEffect(() => {
    setPhase('showing');
    setHighlightIndex(-1);
    setProgressIndex(0);
    setLocked(false);

    let index = 0;
    const interval = setInterval(() => {
      if (index < sequence.length) {
        setHighlightIndex(index);
        index += 1;
      } else {
        clearInterval(interval);
        setHighlightIndex(-1);
        setPhase('input');
      }
    }, 700);

    return () => clearInterval(interval);
  }, [roundState?.roundNumber]);

  const handleColorClick = (color) => {
    if (phase !== 'input' || disabled || locked) return;
    const expected = sequence[progressIndex];
    if (color === expected) {
      const nextIndex = progressIndex + 1;
      setProgressIndex(nextIndex);
      if (nextIndex === sequence.length) {
        setLocked(true);
        onSubmit({ score: sequence.length });
      }
    } else {
      setLocked(true);
      onSubmit({ score: progressIndex });
    }
  };

  return (
    <div className="space-y-4" data-testid="duel-simon-round">
      <p className="text-sm text-gray-600">Memorize the sequence, then repeat it. Round length: {sequence.length}</p>
      <div className="grid grid-cols-2 gap-3">
        {colors.map((color) => {
          const isHighlighted = sequence[highlightIndex] === color;
          return (
            <button
              key={color}
              type="button"
              disabled={disabled || phase !== 'input'}
              onClick={() => handleColorClick(color)}
              className={`h-24 rounded-2xl border-2 transition ${
                color === 'red' ? 'bg-red-400 border-red-500' : ''
              } ${color === 'blue' ? 'bg-blue-400 border-blue-500' : ''} ${color === 'green' ? 'bg-green-400 border-green-500' : ''} ${color === 'yellow' ? 'bg-yellow-300 border-yellow-400' : ''} ${isHighlighted ? 'scale-105 ring-4 ring-white' : 'opacity-80'} `}
              data-testid={`duel-simon-${color}-button`}
            />
          );
        })}
      </div>
      <p className="text-sm text-gray-500">{phase === 'showing' ? 'Watch the sequence…' : 'Your turn: tap the colors in order.'}</p>
    </div>
  );
};

const WhackAMoleRound = ({ onSubmit, disabled }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [activeCell, setActiveCell] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (disabled) return undefined;
    const moleInterval = setInterval(() => {
      setActiveCell(Math.floor(Math.random() * 9));
    }, 650);
    return () => clearInterval(moleInterval);
  }, [disabled]);

  useEffect(() => {
    if (disabled || finished) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setFinished(true);
          onSubmit({ score });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [disabled, finished, score]);

  const hitMole = (index) => {
    if (disabled || finished || index !== activeCell) return;
    setScore((prev) => prev + 1);
    setActiveCell(Math.floor(Math.random() * 9));
  };

  return (
    <div className="space-y-4" data-testid="duel-whack-round">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Time left: {timeLeft}s</span>
        <span>Hits: {score}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => hitMole(index)}
            disabled={disabled || finished}
            className={`h-20 rounded-2xl border-2 text-2xl transition ${index === activeCell ? 'bg-amber-300 border-amber-500 scale-105' : 'bg-gray-100 border-gray-200'}`}
            data-testid={`duel-whack-cell-${index}`}
          >
            {index === activeCell ? '🐹' : ''}
          </button>
        ))}
      </div>
    </div>
  );
};

const DuelChallengeDialog = ({ challenge, currentUser, open, onClose, onRespond, onPlay, onAssign }) => {
  if (!challenge) return null;

  const currentRound = challenge.currentRoundState;
  const waitingForChoice = challenge.status === 'awaiting_choice';
  const isWinner = challenge.isWinner;
  const shouldWait = challenge.userRoundSubmission && challenge.status === 'active';
  const currentRoundWins = challenge.participants?.find((participant) => participant.userId === currentUser.userId)?.roundWins || 0;
  const opponentRoundWins = challenge.opponent?.roundWins || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" aria-describedby="duel-challenge-description">
        <DialogHeader>
          <DialogTitle className="text-2xl">{challenge.taskTitle}</DialogTitle>
          <p id="duel-challenge-description" className="text-sm text-gray-600">
            {challenge.gameType.replaceAll('_', ' ')} • {challenge.roundCount} round duel • Winner chooses “me” or “them” for the chore.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900">{challenge.challengerName} vs {challenge.challengedName}</p>
                <p className="text-sm text-gray-600">Accepted XP: +{challenge.acceptedXp} each • Winner bonus: +{Math.max(1, Math.round(challenge.acceptedXp * challenge.winnerBonusPct))}</p>
              </div>
              <Badge>{challenge.status}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
              <span>Your round wins: {currentRoundWins}</span>
              <span>{challenge.opponent?.displayName} wins: {opponentRoundWins}</span>
            </div>
          </div>

          {challenge.status === 'pending' && challenge.currentUserStatus === 'pending' && (
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => onRespond('accept')} data-testid="duel-accept-button">Accept duel</Button>
              <Button variant="outline" onClick={() => onRespond('decline')} data-testid="duel-decline-button">Decline</Button>
            </div>
          )}

          {challenge.status === 'pending' && challenge.currentUserStatus === 'accepted' && (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              Waiting for {challenge.challengedName} to accept the duel.
            </div>
          )}

          {challenge.status === 'active' && shouldWait && (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500" data-testid="duel-waiting-state">
              You already played round {challenge.currentRound}. Waiting for {challenge.opponent?.displayName}.
            </div>
          )}

          {challenge.status === 'active' && !shouldWait && currentRound && (
            <div className="space-y-4" data-testid="duel-active-round-panel">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Round {challenge.currentRound}</p>
                {currentRound.suddenDeath && <Badge className="mt-2 bg-red-500">Sudden death</Badge>}
              </div>
              {challenge.gameType === 'rock_paper_scissors' && <RpsRound onSubmit={onPlay} />}
              {challenge.gameType === 'trivia' && <TriviaRound key={`${challenge.challengeId}-${challenge.currentRound}`} roundState={currentRound} onSubmit={onPlay} />}
              {challenge.gameType === 'simon' && <SimonRound key={`${challenge.challengeId}-${challenge.currentRound}`} roundState={currentRound} onSubmit={onPlay} />}
              {challenge.gameType === 'whack_a_mole' && <WhackAMoleRound key={`${challenge.challengeId}-${challenge.currentRound}`} onSubmit={onPlay} />}
            </div>
          )}

          {waitingForChoice && isWinner && (
            <div className="grid grid-cols-2 gap-3" data-testid="duel-choice-panel">
              <Button onClick={() => onAssign('me')} data-testid="duel-choose-me-button">I’ll do the chore</Button>
              <Button variant="outline" onClick={() => onAssign('them')} data-testid="duel-choose-them-button">They do the chore</Button>
            </div>
          )}

          {waitingForChoice && !isWinner && (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              {challenge.opponent?.displayName} won the duel and is deciding who gets the chore.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const MiniGameArena = ({ apiBase, currentUser, householdMembers, myTasks, onRefreshGameState }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [challenges, setChallenges] = useState([]);
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [form, setForm] = useState({ taskId: '', challengedId: '', gameType: 'rock_paper_scissors', roundCount: 1 });

  const openChallenge = useMemo(
    () => challenges.find((challenge) => challenge.challengeId === activeChallengeId) || null,
    [challenges, activeChallengeId]
  );

  const duelableTasks = (myTasks || []).filter((task) => !task.completed && !task.duelPending);
  const opponents = (householdMembers || []).filter((member) => member.odId !== currentUser?.userId);

  const loadChallenges = async () => {
    if (!currentUser?.householdId || !currentUser?.userId) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBase}/mini-game-challenges/${currentUser.householdId}/pending?user_id=${currentUser.userId}`);
      setChallenges(response.data.challenges || []);
      if (!form.taskId && duelableTasks[0]) {
        setForm((prev) => ({ ...prev, taskId: duelableTasks[0].taskId }));
      }
      if (!form.challengedId && opponents[0]) {
        setForm((prev) => ({ ...prev, challengedId: opponents[0].odId }));
      }
    } catch (loadError) {
      setError(loadError.response?.data?.detail || 'Could not load duel arena.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
    const interval = setInterval(loadChallenges, 15000);
    return () => clearInterval(interval);
  }, [currentUser?.householdId, currentUser?.userId, myTasks?.length, householdMembers?.length]);

  const syncAfterAction = async (updatedChallenge, shouldRefreshGameState = false) => {
    await loadChallenges();
    if (updatedChallenge?.challengeId) {
      setActiveChallengeId(updatedChallenge.challengeId);
    }
    if (shouldRefreshGameState) {
      await onRefreshGameState?.();
    }
  };

  const runAction = async (request, shouldRefreshGameState = false) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await request();
      await syncAfterAction(response.data.challenge, shouldRefreshGameState);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Mini-game action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const createChallenge = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await axios.post(`${apiBase}/mini-game-challenges/create`, {
        challengerId: currentUser.userId,
        challengedId: form.challengedId,
        taskId: form.taskId,
        gameType: form.gameType,
        roundCount: Number(form.roundCount),
      });
      await syncAfterAction(response.data.challenge, true);
    } catch (createError) {
      setError(createError.response?.data?.detail || 'Could not create mini-game duel.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="mini-game-arena-panel">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Mini-Game Duel Arena</CardTitle>
          <p className="text-sm text-gray-600">Challenge a housemate for one of your chores. Both players get flat XP on accept, then the winner gets +25% extra and chooses “me” or “them” for the chore.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="mini-game-arena-error">{error}</div>}
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <Label>My chore</Label>
              <select className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2" value={form.taskId} onChange={(event) => setForm((prev) => ({ ...prev, taskId: event.target.value }))} data-testid="mini-game-task-select">
                {duelableTasks.map((task) => <option key={task.taskId} value={task.taskId}>{task.title}</option>)}
              </select>
            </div>
            <div>
              <Label>Opponent</Label>
              <select className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2" value={form.challengedId} onChange={(event) => setForm((prev) => ({ ...prev, challengedId: event.target.value }))} data-testid="mini-game-opponent-select">
                {opponents.map((member) => <option key={member.odId} value={member.odId}>{member.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Game type</Label>
              <select className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2" value={form.gameType} onChange={(event) => setForm((prev) => ({ ...prev, gameType: event.target.value }))} data-testid="mini-game-type-select">
                {GAME_OPTIONS.map((game) => <option key={game.value} value={game.value}>{game.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Rounds</Label>
              <select className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2" value={form.roundCount} onChange={(event) => setForm((prev) => ({ ...prev, roundCount: event.target.value }))} data-testid="mini-game-round-count-select">
                <option value={1}>1 round</option>
                <option value={3}>3 rounds</option>
              </select>
            </div>
          </div>
          <Button onClick={createChallenge} disabled={submitting || !form.taskId || !form.challengedId} data-testid="mini-game-create-challenge-button">
            {submitting ? 'Creating duel…' : 'Create duel challenge'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Open duel challenges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500">Loading duel challenges…</p>
          ) : challenges.length > 0 ? challenges.map((challenge) => (
            <div key={challenge.challengeId} className="rounded-2xl border border-gray-200 p-4" data-testid={`mini-game-challenge-${challenge.challengeId}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{challenge.taskTitle}</p>
                  <p className="text-sm text-gray-600">{challenge.gameType.replaceAll('_', ' ')} • {challenge.roundCount} rounds • {challenge.challengerName} vs {challenge.challengedName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{challenge.status}</Badge>
                  <Button variant="outline" onClick={() => setActiveChallengeId(challenge.challengeId)} data-testid={`mini-game-open-challenge-${challenge.challengeId}`}>
                    Open duel
                  </Button>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-gray-500" data-testid="mini-game-empty-state">No open duel challenges yet.</p>
          )}
        </CardContent>
      </Card>

      <DuelChallengeDialog
        challenge={openChallenge}
        currentUser={currentUser}
        open={Boolean(openChallenge)}
        onClose={() => setActiveChallengeId(null)}
        onRespond={(responseType) => runAction(() => axios.post(`${apiBase}/mini-game-challenges/respond`, { challengeId: openChallenge.challengeId, userId: currentUser.userId, response: responseType }), true)}
        onPlay={(payload) => runAction(() => axios.post(`${apiBase}/mini-game-challenges/play`, { challengeId: openChallenge.challengeId, userId: currentUser.userId, roundNumber: openChallenge.currentRound, ...payload }), true)}
        onAssign={(choice) => runAction(() => axios.post(`${apiBase}/mini-game-challenges/assign-task`, { challengeId: openChallenge.challengeId, chooserId: currentUser.userId, choice }), true)}
      />
    </div>
  );
};
