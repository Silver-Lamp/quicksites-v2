'use client';

// components/admin/ppl-repoint-forward.tsx
//
// "Send these calls somewhere else" — change a campaign's destination without touching its number.
//
// ⚠️ THE BUTTON EXISTS BECAUSE THE VERB DID NOT. Every other control here changes a NUMBER and
// carries the forward-to along as a field, so a destination that stops answering had no action
// at all: covingtontow.com rang out on two real leads and the only fix was a hand-written UPDATE
// against production.
//
// ⚠️ It shows the destination's own answer record rather than asking the operator to remember it.
// "0 of 3 answered" is the reason to press this; a bare "Re-point" button is an invitation to
// guess.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usE164 } from '@/lib/phone/formatUs';

export default function PplRepointForward({
  campaignId,
  domain,
  forwardTo,
  answered,
  unanswered,
  suggestedPhone,
  suggestedName,
}: {
  campaignId: string;
  domain: string;
  forwardTo: string | null;
  answered: number;
  unanswered: number;
  /** The recommender's next pick, pre-filled so the common case is one click plus a confirm. */
  suggestedPhone?: string | null;
  suggestedName?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // ⚠️ NORMALISED ON THE WAY IN. Every phone we hold about a business is display-format —
  // `(253) 326-5555`, which is what Places returns — and the route requires E.164. Pre-filling
  // the raw suggestion would hand the operator a value that fails validation the moment they
  // press the button, which is a worse version of the empty field this replaces.
  const [phone, setPhone] = useState(usE164(suggestedPhone) ?? '');
  const [mark, setMark] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Only meaningful once something has been dialled and nothing has been answered. A destination
  // with no calls yet is untested, not failing, and flagging it would train the operator to
  // ignore the flag.
  const looksDead = answered === 0 && unanswered >= 2;

  async function run() {
    const typed = phone.trim();
    // ⚠️ AN EMPTY FIELD IS NOT A FORMAT PROBLEM, AND SAYING SO COST A REAL ATTEMPT. The first
    // version answered a blank box with "Needs an E.164 number, e.g. +1…" — while the box
    // displayed a placeholder that reads exactly like a filled-in value. The operator saw a
    // number, pressed the button, and was told the number was malformed. Name the actual fault.
    if (!typed) {
      setMsg('Enter the number to forward to — the box is empty (the grey number is an example).');
      return;
    }
    // Accept whatever a person can paste. Our own data is display-format, so demanding E.164
    // from a human when we can derive it is friction we invented.
    const e164 = usE164(typed);
    if (!e164) {
      setMsg(`"${typed}" is not a US phone number I can dial. Ten digits, any punctuation.`);
      return;
    }
    if (
      !window.confirm(
        `Send ${domain}'s calls to ${e164}?\n\n` +
          `• ${forwardTo ?? 'nothing'} stops receiving them immediately\n` +
          `• ${e164} is texted the one-time notice as part of this — they are not rung unannounced\n` +
          (mark
            ? `• ${forwardTo} is recorded as not answering, so it is not re-suggested\n`
            : `• ${forwardTo ?? 'The old number'} is NOT written off — it can be suggested again\n`) +
          `• The tracking number and the site are unchanged`,
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/prospects/geo-campaign/set-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          forwardTo: e164,
          markPreviousUnresponsive: mark,
          // What the conclusion rests on, stored with it. A later reader inherits the evidence
          // rather than a verdict they have to take on trust.
          note: mark ? 'operator dialled it directly from an ordinary phone; no answer' : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.error || r.statusText);
        return;
      }
      // ⚠️ Report the notice outcome explicitly. A repoint whose SMS failed has started ringing
      // a business that was told nothing, which is the one result that must never read as a
      // plain success.
      const notice = j.notice?.sent
        ? 'notice sent'
        : `⚠️ NOTICE NOT SENT (${j.notice?.reason ?? 'unknown'}) — they have not been told`;
      const shared = j.alsoForwardsFor?.length
        ? ` ⚠️ also receives calls from ${j.alsoForwardsFor.join(', ')}`
        : '';
      setMsg(`now ${j.to}${j.from ? ` (was ${j.from})` : ''}; ${notice}${shared}`);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {looksDead ? (
        <span className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200">
          0 of {unanswered} answered
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
      >
        {open ? 'Cancel' : 'Re-point'}
      </button>
      {open ? (
        <span className="inline-flex flex-wrap items-center gap-2">
          {/* ⚠️ The placeholder is prose, not a number. A grey `+1…` in an empty box is
              indistinguishable from a filled one at a glance — that is exactly how a blank
              field got submitted and answered with a format complaint. */}
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="phone to forward to"
            aria-label={`New forward-to number for ${domain}`}
            className="w-44 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-mono"
          />
          {suggestedName ? (
            <span className="text-[11px] text-muted-foreground">
              pre-filled: {suggestedName}
            </span>
          ) : (
            <span className="text-[11px] text-amber-300">no suggestion — type a number</span>
          )}
          {/* ⚠️ The label names the TEST, not the conclusion, and that is the whole point.
              Missed calls through our own bridge cannot distinguish "they answer nobody" from
              "they screen the unknown number WE call from" — every one of those calls shares
              the suspect variable, so a hundred of them settle nothing. Dialling from an
              ordinary phone settles it in thirty seconds. AL Ram Towing (2026-09-30) reached
              "the Google subscriber you have dialed is not available", which is what made
              re-pointing the right fix rather than a way to move the problem. */}
          <label
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title="Missed calls through our bridge cannot tell you whether they are screening our number. A direct call can."
          >
            <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} />
            I dialled {forwardTo ?? 'it'} myself and it did not answer
          </label>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
          >
            {busy ? 'Repointing…' : 'Repoint & notify'}
          </button>
        </span>
      ) : null}
      {msg ? <span className="text-[11px] text-muted-foreground">{msg}</span> : null}
    </span>
  );
}
