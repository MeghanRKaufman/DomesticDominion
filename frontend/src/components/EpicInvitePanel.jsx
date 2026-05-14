import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const TONE_STYLES = {
  epic: {
    bg: 'bg-gradient-to-br from-amber-950 via-stone-900 to-stone-950',
    border: 'border-amber-400/40',
    accent: 'text-amber-300',
    codeBox: 'bg-amber-900/40 border-amber-400/50',
    halo: 'shadow-[0_0_60px_-10px_rgba(251,191,36,0.5)]',
    badge: '⚔️ EPIC SCROLL',
  },
  hype: {
    bg: 'bg-gradient-to-br from-fuchsia-900 via-violet-900 to-indigo-950',
    border: 'border-fuchsia-300/40',
    accent: 'text-fuchsia-300',
    codeBox: 'bg-fuchsia-900/40 border-fuchsia-300/50',
    halo: 'shadow-[0_0_60px_-10px_rgba(217,70,239,0.55)]',
    badge: '⚡ HYPE DROP',
  },
  chill: {
    bg: 'bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900',
    border: 'border-emerald-300/40',
    accent: 'text-emerald-200',
    codeBox: 'bg-emerald-900/40 border-emerald-300/50',
    halo: 'shadow-[0_0_60px_-10px_rgba(16,185,129,0.5)]',
    badge: '🌿 INVITE',
  },
};

export function EpicInvitePanel({ apiBase, currentUser }) {
  const [invite, setInvite] = useState(null);
  const [tone, setTone] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const fetchInvite = useCallback(async () => {
    if (!currentUser?.householdId || !currentUser?.userId) return;
    setLoading(true);
    setError('');
    try {
      const params = { inviter_id: currentUser.userId };
      if (tone !== 'auto') params.tone = tone;
      const res = await axios.get(`${apiBase}/households/${currentUser.householdId}/epic-invite`, { params });
      setInvite(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to generate invite');
    } finally {
      setLoading(false);
    }
  }, [apiBase, currentUser, tone]);

  useEffect(() => {
    fetchInvite();
  }, [fetchInvite]);

  const shareUrl = useMemo(() => {
    if (!invite?.inviteCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/?invite=${invite.inviteCode}`;
  }, [invite]);

  const shareText = useMemo(() => {
    if (!invite) return '';
    const parts = [
      `${invite.hook.headline}`,
      '',
      invite.summonLine,
      '',
      invite.hook.body,
      '',
      personalMessage ? `💬 ${invite.inviterName} says: ${personalMessage}` : null,
      personalMessage ? '' : null,
      `🏠 ${invite.appName} — ${invite.appTagline}`,
      '',
      `🔑 Invite code: ${invite.inviteCode}`,
      shareUrl ? `🌐 ${shareUrl}` : null,
    ].filter((line) => line !== null);
    return parts.join('\n');
  }, [invite, personalMessage, shareUrl]);

  const tones = TONE_STYLES[invite?.tone] || TONE_STYLES.epic;

  const copyToClipboard = async (text, label) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopyStatus(`${label} copied!`);
      setTimeout(() => setCopyStatus(''), 2500);
    } catch (e) {
      setCopyStatus('Copy failed — long-press to copy manually.');
      setTimeout(() => setCopyStatus(''), 3500);
    }
  };

  const handleNativeShare = async () => {
    if (!invite) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${invite.appName} — ${invite.householdName}`,
          text: shareText,
          url: shareUrl || undefined,
        });
      } catch (e) {
        // user cancelled, ignore
      }
    } else {
      copyToClipboard(shareText, 'Full invite');
    }
  };

  if (!currentUser?.householdId) return null;

  return (
    <div className="space-y-5" data-testid="epic-invite-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">📜 Epic Invite</h3>
          <p className="text-gray-600 text-sm">A grandiose, shareable scroll that explains the game and embeds your household code.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs uppercase tracking-wide text-gray-500">Tone</label>
          <select
            data-testid="epic-invite-tone-select"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="auto">Auto (theme-based)</option>
            <option value="epic">Epic / RPG</option>
            <option value="hype">Cool / Hype</option>
            <option value="chill">Friendly / Chill</option>
          </select>
          <button
            type="button"
            onClick={fetchInvite}
            data-testid="epic-invite-reroll"
            className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            🎲 New Hook
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-sm">{error}</div>
      )}

      {invite && (
        <div className={`rounded-3xl border ${tones.border} ${tones.bg} ${tones.halo} text-white p-7 md:p-10 relative overflow-hidden`} data-testid="epic-invite-poster">
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px, 60px 60px',
          }} />

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <span className={`text-xs font-semibold tracking-[0.3em] ${tones.accent}`}>{tones.badge}</span>
              <span className="text-xs uppercase tracking-widest opacity-70">{invite.appName}</span>
            </div>

            <p className={`uppercase tracking-[0.2em] text-xs mb-3 ${tones.accent}`}>
              {invite.summonLine}
            </p>
            <h2 className="text-3xl md:text-5xl font-black leading-tight mb-4" data-testid="epic-invite-headline">
              {invite.hook.headline}
            </h2>
            <p className="text-lg md:text-xl leading-relaxed opacity-90 mb-6 max-w-2xl" data-testid="epic-invite-body">
              {invite.hook.body}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mb-8 text-sm md:text-base">
              {invite.valueBullets.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`${tones.accent} mt-0.5`}>▸</span>
                  <span className="opacity-90">{line}</span>
                </div>
              ))}
            </div>

            {personalMessage && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 max-w-2xl">
                <div className="text-xs uppercase tracking-widest opacity-70 mb-1">A note from {invite.inviterName}</div>
                <p className="italic text-base" data-testid="epic-invite-personal-msg-preview">{personalMessage}</p>
              </div>
            )}

            <div className={`flex flex-col md:flex-row items-stretch md:items-end gap-4 ${tones.codeBox} border rounded-2xl p-5 max-w-2xl`}>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Invite Code</div>
                <div className="text-4xl md:text-5xl font-black tracking-[0.3em] font-mono" data-testid="epic-invite-code">
                  {invite.inviteCode}
                </div>
                <div className="text-xs opacity-70 mt-2">
                  {invite.seatsOpen > 0
                    ? `${invite.seatsOpen} seat${invite.seatsOpen === 1 ? '' : 's'} open · ${invite.currentMembers}/${invite.maxMembers} members`
                    : 'Household is full — current members can welcome them at next opening'}
                </div>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                {shareUrl && (
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`underline text-xs ${tones.accent} text-right break-all max-w-[260px]`}
                  >
                    {shareUrl}
                  </a>
                )}
                <span className="text-xs opacity-60">Tap below to share</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">
          Add a personal note (optional)
        </label>
        <textarea
          data-testid="epic-invite-personal-message"
          value={personalMessage}
          onChange={(e) => setPersonalMessage(e.target.value.slice(0, 240))}
          rows={2}
          placeholder="Hey — would love to have you on the team. We promise the kitchen quests get easier."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <div className="text-xs text-gray-400 text-right">{personalMessage.length}/240</div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleNativeShare}
            data-testid="epic-invite-share-button"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            disabled={!invite}
          >
            📤 Share Invite
          </button>
          <button
            type="button"
            onClick={() => invite && copyToClipboard(shareText, 'Full invite')}
            data-testid="epic-invite-copy-full"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
            disabled={!invite}
          >
            📋 Copy Full Invite
          </button>
          <button
            type="button"
            onClick={() => invite && copyToClipboard(invite.inviteCode, 'Code')}
            data-testid="epic-invite-copy-code"
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            disabled={!invite}
          >
            🔑 Copy Code Only
          </button>
          {shareUrl && (
            <button
              type="button"
              onClick={() => copyToClipboard(shareUrl, 'Link')}
              data-testid="epic-invite-copy-link"
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50"
            >
              🔗 Copy Link
            </button>
          )}
        </div>
        {copyStatus && (
          <div className="text-emerald-600 text-sm font-medium" data-testid="epic-invite-copy-status">{copyStatus}</div>
        )}
      </div>

      {loading && <p className="text-center text-gray-400 text-sm">Crafting your scroll…</p>}
    </div>
  );
}

export default EpicInvitePanel;
