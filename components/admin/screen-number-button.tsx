'use client';

// One button per call-log row: screen this caller (send future calls to voicemail instead of
// the business) or lift the screen. Posts to /api/admin/caller-screens; the page re-renders on
// the next load — the state here is only the click's own result.
import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function ScreenNumberButton({ number, callId, screened, evidence }: { number: string; callId: string; screened: boolean; evidence?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  async function go() {
    if (!screened && !confirm(`Screen ${number}? Future calls from it go to voicemail instead of the business. A real customer can still leave a message.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/caller-screens', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(screened ? { number, release: true } : { number, call_id: callId, evidence }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j?.error ?? 'failed');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={go} disabled={busy} className={`rounded px-1.5 py-0.5 text-[11px] ${screened ? 'border border-emerald-500/40 text-emerald-300' : 'border border-rose-500/40 text-rose-300'} disabled:opacity-50`} title={screened ? 'Lift the screen: forward this number again' : 'Screen: send this number to voicemail, never to the business'}>
        {busy ? '…' : screened ? 'Unscreen' : 'Screen'}
      </button>
      {err && <span className="text-[11px] text-rose-400">{err}</span>}
    </span>
  );
}
