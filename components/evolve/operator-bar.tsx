'use client';

// components/evolve/operator-bar.tsx
//
// The operator's strip at the top of an Evolve page, shown only to a signed-in member (owner,
// 2026-10-11: "if I'm logged in, buttons where I can copy a DM post for FB and text this to the
// business"; later the same day: "click a button and add a note for 'texted them' … see if a
// postcard has been sent, and send a postcard from these areas as well"). A visitor — the
// restaurant owner the page is for — never sees it. Drafts come from lib/rep/repBuild.ts (held
// to the forbidden list by test); the admin-only pieces (claim link, postcard preview and MAIL —
// postage) are passed in by the server page, which prepared them only for an admin session.
//
// ⚠️ "Texted them ✓" / "Sent the DM ✓" POST the exact draft as the touch body: a record of what
// went out, never a bare tally (lib/outreach/touches.ts#validateTouch).
import * as React from 'react';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';
import { repOrderingDmDraft, repOrderingSmsDraft, smsHref } from '@/lib/rep/repBuild';

export type OperatorBarProps = {
  prospectId: string;
  businessName: string;
  phone: string | null;
  evolveUrl: string;
  previewUrl: string | null;
  /** What has already happened: last text / DM logged, the latest real card as one line. */
  marks: { textedAt: string | null; dmAt: string | null; cardLine: string | null };
  /** Admin-only extras, null for a member who is not an admin. */
  admin: { claimUrl: string | null; cardFrontUrl: string | null; cardBackUrl: string | null; senderName: string; postcardBlocked: string | null } | null;
};

const pill = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50';
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function OperatorBar(p: OperatorBarProps) {
  const { user, ready } = React.useContext(CurrentUserContext);
  const [note, setNote] = React.useState('');
  const [textedAt, setTextedAt] = React.useState(p.marks.textedAt);
  const [dmAt, setDmAt] = React.useState(p.marks.dmAt);
  const [cardLine, setCardLine] = React.useState(p.marks.cardLine);
  const [busy, setBusy] = React.useState<string | null>(null);
  const member = ready && !!user && !(user as { is_anonymous?: boolean | null }).is_anonymous;
  if (!member) return null;
  const repName = p.admin?.senderName || (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] || (user?.email ?? '').split('@')[0].split('+')[0] || 'a QuickSites rep';
  const dm = repOrderingDmDraft({ repName, businessName: p.businessName, evolveUrl: p.evolveUrl });
  const sms = repOrderingSmsDraft({ repName, businessName: p.businessName, previewUrl: p.previewUrl ?? p.evolveUrl, evolveUrl: p.evolveUrl });
  const flash = (s: string) => { setNote(s); setTimeout(() => setNote(''), 2500); };
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); flash(`${label} copied.`); } catch { window.prompt(label, text); }
  };
  async function logTouch(channel: 'sms' | 'dm', body: string) {
    setBusy(channel);
    try {
      const res = await fetch('/api/rep/touch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prospectId: p.prospectId, channel, body }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { flash(`Could not log it (${j?.error ?? res.status}).`); return; }
      if (channel === 'sms') setTextedAt(j.occurredAt); else setDmAt(j.occurredAt);
      flash('Logged.');
    } finally { setBusy(null); }
  }
  async function mailCard() {
    if (!window.confirm(`Mail the Evolve postcard to ${p.businessName}? This spends postage — one real card to their listed address.`)) return;
    setBusy('card');
    try {
      const res = await fetch('/api/admin/prospects/mail-evolve-postcards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prospectIds: [p.prospectId], limit: 1 }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { flash(`Not mailed: ${j?.code ?? j?.error ?? res.status}.`); return; }
      const r = Array.isArray(j.results) ? j.results[0] : null;
      if (j.mailed >= 1) { setCardLine(`mailed ${fmtDay(new Date().toISOString())} · in transit · 0 scans`); flash('Card mailed.'); }
      else flash(`Not mailed: ${r?.blocked ?? r?.error ?? 'blocked'}.`);
    } finally { setBusy(null); }
  }
  return (
    <div className="mx-auto max-w-6xl px-6 pt-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">You, not them</span>
        <button type="button" onClick={() => copy('DM', dm)} className={`${pill} border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20`}>Copy DM for Facebook</button>
        {dmAt ? (
          <span className="text-xs text-emerald-300">DM sent {fmtDay(dmAt)} ✓</span>
        ) : (
          <button type="button" disabled={busy === 'dm'} onClick={() => logTouch('dm', dm)} className={`${pill} border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60`} title="Logs the DM above as sent">Sent the DM ✓</button>
        )}
        {p.phone ? (
          <a href={smsHref(p.phone, sms)} className={`${pill} border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`}>Text this to {p.businessName}</a>
        ) : (
          <button type="button" onClick={() => copy('Text', sms)} className={`${pill} border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`} title="No phone on the prospect — copies the text instead">Copy the text</button>
        )}
        {textedAt ? (
          <span className="text-xs text-emerald-300">texted {fmtDay(textedAt)} ✓</span>
        ) : (
          <button type="button" disabled={busy === 'sms'} onClick={() => logTouch('sms', sms)} className={`${pill} border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60`} title="Logs the text above as sent">Texted them ✓</button>
        )}
        <button type="button" onClick={() => copy('Evolve link', p.evolveUrl)} className={`${pill} border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700/60`}>Copy this page’s link</button>
        {p.admin?.claimUrl && (
          <button type="button" onClick={() => copy('Claim link', p.admin!.claimUrl!)} title="For the owner only — send it privately, never post it" className={`${pill} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}>Copy claim link</button>
        )}
        <span className={`${pill} border-violet-500/40 bg-violet-500/10 text-violet-200`}>
          {cardLine ? `Card ${cardLine}` : 'No card mailed'}
          {p.admin?.cardFrontUrl && p.admin?.cardBackUrl && (
            <>
              {' · '}
              <a href={p.admin.cardFrontUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">front</a>
              {' · '}
              <a href={p.admin.cardBackUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">back</a>
            </>
          )}
        </span>
        {p.admin && !cardLine && (
          p.admin.postcardBlocked ? (
            <span className="text-xs text-zinc-400" title="Why no card can go out">can’t mail: {p.admin.postcardBlocked.replace(/_/g, ' ')}</span>
          ) : (
            <button type="button" disabled={busy === 'card'} onClick={mailCard} className={`${pill} border-violet-500/50 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25`}>
              {busy === 'card' ? 'Mailing…' : 'Mail the postcard'}
            </button>
          )
        )}
        {note && <span className="text-xs text-zinc-300">{note}</span>}
      </div>
    </div>
  );
}
