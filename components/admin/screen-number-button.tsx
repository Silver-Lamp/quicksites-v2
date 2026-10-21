'use client';

// Per call-log row: screen this caller (future calls go to voicemail instead of the business),
// BLOCK it (future calls are rejected unanswered — owner, 2026-10-21), or lift either. Posts to
// /api/admin/caller-screens; the page re-renders on the next load — the state here is only the
// click's own result.
import * as React from 'react';
import { useRouter } from 'next/navigation';

export type ListedMode = 'screen' | 'block' | null;

export default function ScreenNumberButton({ number, callId, listed, evidence }: { number: string; callId: string; listed: ListedMode; evidence?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/caller-screens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j?.error ?? 'failed');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const screen = () => {
    if (!confirm(`Screen ${number}? Future calls from it go to voicemail instead of the business. A real customer can still leave a message.`)) return;
    void post({ number, call_id: callId, evidence, mode: 'screen' });
  };
  const block = () => {
    if (!confirm(`Block ${number}? Future calls from it are rejected unanswered — no voicemail, no text, no email. Use for a number that has proven itself a dialer; a possible person gets Screen.`)) return;
    void post({ number, call_id: callId, evidence, mode: 'block' });
  };
  const release = () => void post({ number, release: true });
  const btn = 'rounded px-1.5 py-0.5 text-[11px] disabled:opacity-50';
  return (
    <span className="inline-flex items-center gap-1">
      {listed ? (
        <button type="button" onClick={release} disabled={busy} className={`${btn} border border-emerald-500/40 text-emerald-300`} title={listed === 'block' ? 'Lift the block: answer this number again' : 'Lift the screen: forward this number again'}>
          {busy ? '…' : listed === 'block' ? 'Unblock' : 'Unscreen'}
        </button>
      ) : (
        <>
          <button type="button" onClick={screen} disabled={busy} className={`${btn} border border-rose-500/40 text-rose-300`} title="Screen: send this number to voicemail, never to the business">
            {busy ? '…' : 'Screen'}
          </button>
          <button type="button" onClick={block} disabled={busy} className={`${btn} border border-zinc-500/50 text-zinc-300`} title="Block: reject this number unanswered — no voicemail, no text, no email">
            Block
          </button>
        </>
      )}
      {err && <span className="text-[11px] text-rose-400">{err}</span>}
    </span>
  );
}
