'use client';

// components/merchant/connect-hj-card.tsx — "Connect floor plan & food cost (HiveJournal)" on
// the owner's bookings page. Mints a one-time code (POST /api/booking/<id>/link), shows it once
// with the link into HJ, shows the live link state, and disconnects (POST …/unlink). The partner
// cannot read this site's bookings until the owner has done this — lib/booking/partnerLink.ts.
import * as React from 'react';

type Status = { status: 'none' | 'pending' | 'linked' | 'unlinked'; linked_at: string | null; partner_ref: string | null; unlinked_at: string | null; code_expires_at: string | null };

export default function ConnectHjCard({ templateId }: { templateId: string }) {
  const [st, setSt] = React.useState<Status | null>(null);
  const [code, setCode] = React.useState<{ code: string; connect_url: string; expires_at: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const r = await fetch(`/api/booking/${templateId}/link`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (r.ok && j) setSt(j);
  }, [templateId]);
  React.useEffect(() => {
    load();
  }, [load]);

  async function mint() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/booking/${templateId}/link`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j?.error === 'needs_signup' ? 'Create your account first — a draft you have not claimed cannot be shared.' : j?.error === 'already_linked' ? 'Already connected.' : 'Could not create a code.');
        return;
      }
      setCode({ code: j.code, connect_url: j.connect_url, expires_at: j.expires_at });
      load();
    } finally {
      setBusy(false);
    }
  }
  async function unlink() {
    if (!confirm('Disconnect HiveJournal? Their floor plan stops reading this site’s bookings immediately. You can reconnect with a new code.')) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/booking/${templateId}/unlink`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'owner disconnected' }) });
      if (!r.ok) setErr('Could not disconnect.');
      setCode(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  const linked = st?.status === 'linked';
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-card-foreground">Floor plan &amp; food cost (HiveJournal)</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${linked ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>{linked ? 'connected' : st?.status === 'pending' ? 'code issued' : 'not connected'}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        HiveJournal draws your room, places bookings on tables as they land, and runs a food-cost calculator. Nothing is shared until you connect, and you can disconnect any time. They receive bookings and tables, never a guest&apos;s phone or email.
      </p>
      {linked ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground">Connected {st?.linked_at ? `on ${st.linked_at.slice(0, 10)}` : ''}.</span>
          <button type="button" onClick={unlink} disabled={busy} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-foreground disabled:opacity-50">
            Disconnect
          </button>
        </div>
      ) : code ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-300">Your one-time code · expires in 15 minutes</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-widest text-foreground">{code.code}</div>
          <a href={code.connect_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">
            Open HiveJournal to finish connecting →
          </a>
          <p className="mt-2 text-xs text-muted-foreground">The code works once. If it expires, make a new one here.</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={mint} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? '…' : 'Connect HiveJournal'}
          </button>
          {st?.status === 'unlinked' && <span className="text-xs text-muted-foreground">Disconnected {st.unlinked_at?.slice(0, 10)}. Reconnect with a new code.</span>}
        </div>
      )}
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
    </div>
  );
}
