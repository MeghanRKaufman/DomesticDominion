import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=IM+Fell+English:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,400;700;800;900&family=Outfit:wght@400;500;700;900&family=Fraunces:opsz,wght@9..144,400;600;700&family=Caveat:wght@400;600;700&family=Nunito:wght@400;600;700&display=swap';

function ensureFontsLoaded() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('epic-invite-fonts')) return;
  const link = document.createElement('link');
  link.id = 'epic-invite-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const TONE_OPTIONS = [
  { key: 'auto', label: 'Auto (theme)' },
  { key: 'epic', label: 'Epic · Scroll' },
  { key: 'hype', label: 'Hype · Brutalist' },
  { key: 'chill', label: 'Chill · Pinboard' },
];

const BULLET_ICON = { epic: '◆', hype: '[×]', chill: '✨' };

export function EpicInvitePanel({ apiBase, currentUser }) {
  const [invite, setInvite] = useState(null);
  const [tone, setTone] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => { ensureFontsLoaded(); }, []);

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

  useEffect(() => { fetchInvite(); }, [fetchInvite]);

  const shareUrl = useMemo(() => {
    if (!invite?.inviteCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/?invite=${invite.inviteCode}`;
  }, [invite]);

  const shareText = useMemo(() => {
    if (!invite) return '';
    return [
      invite.hook.headline,
      '',
      invite.summonLine,
      '',
      invite.hook.body,
      personalMessage ? `\n💬 ${invite.inviterName} says: ${personalMessage}` : '',
      `\n🏠 ${invite.appName} — ${invite.appTagline}`,
      `\n🔑 Invite code: ${invite.inviteCode}`,
      shareUrl ? `🌐 ${shareUrl}` : '',
    ].filter(Boolean).join('\n');
  }, [invite, personalMessage, shareUrl]);

  const copyToClipboard = async (text, label) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopyStatus(`${label} copied!`);
      setTimeout(() => setCopyStatus(''), 2500);
    } catch {
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
      } catch { /* user cancelled */ }
    } else {
      copyToClipboard(shareText, 'Full invite');
    }
  };

  if (!currentUser?.householdId) return null;

  const activeTone = invite?.tone || 'epic';
  const bullets = invite?.valueBullets || [];

  return (
    <div className="space-y-6" data-testid="epic-invite-panel">
      {/* Header / admin controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">📜 Epic Invite</h3>
          <p className="text-gray-600 text-sm">A designed scroll for recruiting housemates. Tap a tone, reroll, then share.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            data-testid="epic-invite-tone-select"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {TONE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
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

      {/* THE ARTIFACT */}
      {invite && activeTone === 'epic' && <EpicScroll invite={invite} personalMessage={personalMessage} onCopyCode={() => copyToClipboard(invite.inviteCode, 'Code')} bullets={bullets} />}
      {invite && activeTone === 'hype' && <HypeDrop invite={invite} personalMessage={personalMessage} onCopyCode={() => copyToClipboard(invite.inviteCode, 'Code')} bullets={bullets} />}
      {invite && activeTone === 'chill' && <ChillPinboard invite={invite} personalMessage={personalMessage} onCopyCode={() => copyToClipboard(invite.inviteCode, 'Code')} bullets={bullets} />}

      {/* Personal note + share bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Add a personal note (optional)</label>
        <textarea
          data-testid="epic-invite-personal-message"
          value={personalMessage}
          onChange={(e) => setPersonalMessage(e.target.value.slice(0, 240))}
          rows={2}
          placeholder="Hey — would love to have you on the team. The kitchen quests get easier, promise."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        />
        <div className="text-xs text-gray-400 text-right">{personalMessage.length}/240</div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={handleNativeShare} data-testid="epic-invite-share-button"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50" disabled={!invite}>
            📤 Share Invite
          </button>
          <button type="button" onClick={() => invite && copyToClipboard(shareText, 'Full invite')} data-testid="epic-invite-copy-full"
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50" disabled={!invite}>
            📋 Copy Full Invite
          </button>
          <button type="button" onClick={() => invite && copyToClipboard(invite.inviteCode, 'Code')} data-testid="epic-invite-copy-code"
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50" disabled={!invite}>
            🔑 Copy Code Only
          </button>
          {shareUrl && (
            <button type="button" onClick={() => copyToClipboard(shareUrl, 'Link')} data-testid="epic-invite-copy-link"
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-sm font-semibold hover:bg-gray-50">
              🔗 Copy Link
            </button>
          )}
        </div>
        {copyStatus && <div className="text-emerald-600 text-sm font-medium" data-testid="epic-invite-copy-status">{copyStatus}</div>}
        {shareUrl && <p className="text-xs text-gray-500">Recipients who tap your link land directly on this household's join screen — no code typing required.</p>}
      </div>

      {loading && <p className="text-center text-gray-400 text-sm">Crafting your scroll…</p>}
    </div>
  );
}

/* ----- EPIC : medieval scroll ----- */
function EpicScroll({ invite, personalMessage, onCopyCode, bullets }) {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto bg-[#1a1511] border-4 border-[#3a2e24] p-8 md:p-12 text-center rounded-sm text-[#e8d5b5]"
      style={{
        backgroundImage: 'radial-gradient(circle at center, #2a221b 0%, #1a1511 100%)',
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.9)',
        fontFamily: "'IM Fell English', serif",
      }}
      data-testid="epic-invite-poster"
    >
      <div className="absolute inset-2 border border-[#4a3b2c] pointer-events-none opacity-60" />
      <div className="relative">
        <div className="inline-block px-4 py-1.5 border border-[#c2a373] text-[#c2a373] text-xs uppercase tracking-[0.3em] mb-8 bg-[#2a221b]/80 shadow-[0_0_10px_rgba(194,163,115,0.1)]" style={{ fontFamily: "'Cinzel', serif" }}>
          ⚔ Royal Decree
        </div>
        <p className="text-[#c2a373] text-sm md:text-base tracking-[0.2em] uppercase mb-4 opacity-80" style={{ fontFamily: "'Cinzel', serif" }}>
          {invite.summonLine}
        </p>
        <h2 className="text-[#e8d5b5] text-4xl md:text-5xl font-bold mb-4 leading-tight drop-shadow-md" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.04em' }} data-testid="epic-invite-headline">
          {invite.hook.headline}
        </h2>
        <p className="text-[#a89070] text-lg md:text-xl mb-2 max-w-lg mx-auto leading-relaxed italic" data-testid="epic-invite-body">
          {invite.hook.body}
        </p>

        {personalMessage && (
          <div className="mt-8 mb-4 text-[#c2a373] italic text-xl md:text-2xl px-4 md:px-12 opacity-90" style={{ fontFamily: "'IM Fell English', serif" }} data-testid="epic-invite-personal-msg-preview">
            &ldquo;{personalMessage}&rdquo;
          </div>
        )}

        <button
          type="button"
          onClick={onCopyCode}
          className="my-10 py-8 border-y-2 border-[#4a3b2c] relative bg-[#15110d]/50 w-full hover:bg-[#15110d]/70 transition-colors group"
          data-testid="epic-invite-code-block"
        >
          <div className="text-[#8a6b3d] uppercase text-xs tracking-[0.3em] mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Sigil of Entry</div>
          <div className="text-5xl md:text-7xl font-black tracking-[0.15em] drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
               style={{ fontFamily: "'Cinzel', serif", background: 'linear-gradient(180deg,#fce9c0 0%,#c2a373 50%,#8a6b3d 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
               data-testid="epic-invite-code">
            {invite.inviteCode}
          </div>
          <div className="text-[#8a6b3d] text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity">tap to copy</div>
        </button>

        <div className="text-[#a89070] text-base md:text-lg space-y-4 flex flex-col items-center max-w-md mx-auto mb-10">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-3 text-left">
              <span className="text-[#c2a373] text-sm">{BULLET_ICON.epic}</span>
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="text-[#8a6b3d] text-xs tracking-[0.3em] uppercase mt-6" style={{ fontFamily: "'Cinzel', serif" }}>
          {invite.appName} · {invite.seatsOpen} {invite.seatsOpen === 1 ? 'seat remains' : 'seats remain'}
        </div>
      </div>
    </div>
  );
}

/* ----- HYPE : neo-brutalist drop ----- */
function HypeDrop({ invite, personalMessage, onCopyCode, bullets }) {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto bg-[#ccff00] border-4 border-black p-8 md:p-10 shadow-[12px_12px_0_0_rgba(0,0,0,1)] rounded-none overflow-hidden text-black"
      style={{
        backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
        backgroundSize: '24px 24px',
        backgroundPosition: '0 0',
        fontFamily: "'Outfit', sans-serif",
      }}
      data-testid="epic-invite-poster"
    >
      <div className="relative">
        <div className="inline-block px-4 py-1.5 bg-black text-[#ccff00] text-sm font-black uppercase tracking-widest mb-6 shadow-[4px_4px_0_0_rgba(255,255,255,1)] hover:-translate-y-1 transition-transform" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          ⚡ Recruitment Drop
        </div>

        <div className="text-black text-sm md:text-base font-black uppercase tracking-tight bg-white inline-block px-3 py-1 border-2 border-black -rotate-2 mb-6 shadow-[2px_2px_0_0_rgba(0,0,0,1)]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          {invite.summonLine}
        </div>

        <h2 className="text-black text-5xl md:text-7xl font-black uppercase leading-[0.85] tracking-tighter mb-4 break-words" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }} data-testid="epic-invite-headline">
          {invite.hook.headline}
        </h2>

        <p className="text-black text-lg md:text-xl font-bold mb-6 max-w-lg leading-tight bg-white/90 p-3 inline-block" data-testid="epic-invite-body">
          {invite.hook.body}
        </p>

        {personalMessage && (
          <div className="bg-white border-4 border-black p-5 text-black font-bold text-lg md:text-xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] my-8 rotate-1 relative" data-testid="epic-invite-personal-msg-preview">
            <div className="absolute -top-3 left-4 bg-black text-[#ccff00] text-xs font-black uppercase tracking-widest px-2 py-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {invite.inviterName} says
            </div>
            {personalMessage}
          </div>
        )}

        <button
          type="button"
          onClick={onCopyCode}
          className="block w-full my-8 bg-black p-6 md:p-8 border-4 border-black transform rotate-1 shadow-[8px_8px_0_0_rgba(255,255,255,1)] hover:rotate-0 transition-transform"
          data-testid="epic-invite-code-block"
        >
          <div className="text-[#ccff00] text-xs uppercase tracking-widest mb-2 font-black" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Your Access Code</div>
          <div
            className="text-6xl md:text-8xl font-black tracking-tighter text-center uppercase break-all"
            style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: 'linear-gradient(90deg,#ccff00,#00e5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            data-testid="epic-invite-code"
          >
            {invite.inviteCode}
          </div>
        </button>

        <div className="text-black text-base md:text-lg font-black space-y-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-left bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] mb-6">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-lg" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{BULLET_ICON.hype}</span>
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="bg-black text-[#ccff00] inline-block px-3 py-1.5 text-xs font-black uppercase tracking-widest" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          {invite.appName} · {invite.seatsOpen} {invite.seatsOpen === 1 ? 'seat' : 'seats'} left
        </div>
      </div>
    </div>
  );
}

/* ----- CHILL : pinboard ----- */
function ChillPinboard({ invite, personalMessage, onCopyCode, bullets }) {
  return (
    <div
      className="relative w-full max-w-2xl mx-auto bg-[#fffdf7] border border-[#f0e6d2] p-8 md:p-12 shadow-2xl rounded-[2.5rem] text-[#4a3f35] overflow-visible mt-12"
      style={{ boxShadow: '0 20px 60px -20px rgba(224, 122, 95, 0.25)', fontFamily: "'Nunito', sans-serif" }}
      data-testid="epic-invite-poster"
    >
      {personalMessage && (
        <div className="absolute -top-10 -right-4 md:-right-10 bg-[#f9f1b4] p-5 shadow-lg text-[#4a3f35] text-2xl md:text-3xl rotate-6 max-w-[220px] border border-[#ebd888] z-10"
             style={{ fontFamily: "'Caveat', cursive", lineHeight: 1.15 }}
             data-testid="epic-invite-personal-msg-preview">
          {personalMessage}
        </div>
      )}

      <div className="mx-auto table px-5 py-2 bg-[#f4a261]/15 text-[#d05e3f] rounded-full text-sm font-bold tracking-wide mb-6 border border-[#f4a261]/30">
        🌿 Friendly Invite
      </div>

      <p className="text-[#e07a5f] text-sm md:text-base font-bold tracking-widest mb-3 text-center uppercase">
        {invite.summonLine}
      </p>
      <h2 className="text-[#4a3f35] text-4xl md:text-5xl font-bold mb-4 text-center leading-tight tracking-tight"
          style={{ fontFamily: "'Fraunces', serif" }} data-testid="epic-invite-headline">
        {invite.hook.headline}
      </h2>
      <p className="text-[#6d5c4f] text-lg md:text-xl text-center max-w-md mx-auto mb-6 leading-relaxed" data-testid="epic-invite-body">
        {invite.hook.body}
      </p>

      <button
        type="button"
        onClick={onCopyCode}
        className="block w-full my-10 bg-white border-2 border-[#f4efdf] rounded-3xl p-8 md:p-10 shadow-lg text-center transform hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden"
        data-testid="epic-invite-code-block"
      >
        <div className="text-[#e07a5f]/80 text-xs uppercase tracking-widest mb-2 font-bold">Your Invite Code</div>
        <div className="text-5xl md:text-7xl font-bold text-[#e07a5f] tracking-widest drop-shadow-sm" style={{ fontFamily: "'Fraunces', serif" }} data-testid="epic-invite-code">
          {invite.inviteCode}
        </div>
        <div className="text-[#a89070] text-xs mt-3">tap to copy</div>
      </button>

      <div className="text-[#6d5c4f] text-base md:text-lg space-y-3 max-w-md mx-auto mb-6 bg-[#fbf8f1] p-6 rounded-2xl border border-[#f0e6d2]">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-xl drop-shadow-sm">{BULLET_ICON.chill}</span>
            <span>{b}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-[#a89070] text-xs uppercase tracking-widest font-bold">
        {invite.appName} · {invite.seatsOpen} {invite.seatsOpen === 1 ? 'seat open' : 'seats open'}
      </div>
    </div>
  );
}

export default EpicInvitePanel;
