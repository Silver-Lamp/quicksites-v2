'use client';

// Referral Codes admin. Mint a vanity code (no owner needed), copy its share link, watch
// signups + held commissions accrue, and finalize the owner once they sign up + connect Stripe.
// The actual payout/transfer of held commissions stays in the payout wizard (a money action).

import * as React from 'react';

type Code = {
  code: string;
  label: string | null;
  owner_email: string | null;
  owner_id: string | null;
  plan: any;
  status: string;
  claimed_at: string | null;
  signups: number;
  held_cents: number;
  paid_cents: number;
  currency: string;
};
type Signup = { user_id: string; email: string | null; source: string | null; created_at: string };

const fmt = (c: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format((c || 0) / 100);

const planLabel = (plan: any) => {
  const rate = Math.round((Number(plan?.rate) || 0) * 100);
  const months = Number(plan?.duration_months) || 0;
  return `${rate}% · ${months === 0 ? 'lifetime' : `${months} mo`}`;
};

export default function ReferralCodesClient() {
  const [codes, setCodes] = React.useState<Code[]>([]);
  const [base, setBase] = React.useState('https://www.quicksites.ai');
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/referrals/codes', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        setCodes(j.codes as Code[]);
        setBase(j.base);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const linkFor = (code: string) => `${base.replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`;
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-neutral-200">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">🎟️ Referral Codes</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Mint a code, share the link, and let signups + commissions accrue. Finalize the owner (+
          Stripe) whenever they’re ready — held commissions transfer then, or at the next sale if
          they’re already connected.
        </p>
      </header>

      <CreateForm onCreated={load} />

      <section className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Codes</h2>
        {loading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No codes yet — create one above.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {codes.map((c) => (
              <CodeRow
                key={c.code}
                c={c}
                link={linkFor(c.code)}
                onCopy={copy}
                copied={copied}
                onChanged={load}
                fmt={fmt}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-neutral-500">
        Month-end payouts + the corrective transfer of held balances live in the{' '}
        <a href="/admin/referrals/payout-wizard" className="text-sky-400 hover:underline">
          payout wizard
        </a>
        .
      </p>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [rate, setRate] = React.useState(25); // affiliate default (share of the platform fee)
  const [lifetime, setLifetime] = React.useState(true);
  const [months, setMonths] = React.useState(12);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await fetch('/api/admin/referrals/quick-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          label,
          ownerEmail: email,
          ratePct: rate,
          lifetime,
          durationMonths: lifetime ? 0 : months,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Could not create code.');
      setMsg(`Created “${j.code.code}”. Share: ${j.links.ref}`);
      setCode('');
      setLabel('');
      setEmail('');
      onCreated();
    } catch (e: any) {
      setErr(e?.message || 'Could not create code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">Create a code</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-neutral-400">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            placeholder="daniel"
            autoCapitalize="none"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-white"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-400">Label (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Daniel (DeckSketch)"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-400">Their email (optional — for finalizing later)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="daniel@decksketch.ai"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
          />
        </label>
        <div className="flex items-end gap-3">
          <label className="text-sm">
            <span className="text-neutral-400">Rate %</span>
            <input
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              type="number"
              min={1}
              max={100}
              className="mt-1 w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={lifetime}
              onChange={(e) => setLifetime(e.target.checked)}
            />
            Lifetime
          </label>
          {!lifetime && (
            <label className="text-sm">
              <span className="text-neutral-400">Months</span>
              <input
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                type="number"
                min={1}
                className="mt-1 w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
              />
            </label>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create code'}
        </button>
        {msg && <span className="text-sm text-emerald-400">{msg}</span>}
        {err && <span className="text-sm text-red-400">{err}</span>}
      </div>
    </form>
  );
}

function CodeRow({
  c,
  link,
  onCopy,
  copied,
  onChanged,
  fmt,
}: {
  c: Code;
  link: string;
  onCopy: (label: string, text: string) => void;
  copied: string | null;
  onChanged: () => void;
  fmt: (c: number, cur?: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [signups, setSignups] = React.useState<Signup[] | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const [claimEmail, setClaimEmail] = React.useState(c.owner_email || '');
  const [claimMsg, setClaimMsg] = React.useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && signups === null) {
      const r = await fetch(`/api/admin/referrals/codes/${encodeURIComponent(c.code)}/signups`, {
        cache: 'no-store',
      });
      const j = await r.json();
      if (r.ok) setSignups(j.signups as Signup[]);
    }
  };

  const claim = async () => {
    setClaiming(true);
    setClaimMsg(null);
    try {
      const r = await fetch('/api/admin/referrals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c.code, email: claimEmail }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Claim failed.');
      setClaimMsg('✓ Owner linked. Held commissions will transfer on the next payout run.');
      onChanged();
    } catch (e: any) {
      setClaimMsg(e?.message || 'Claim failed.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <li className="rounded-xl border border-neutral-800 bg-neutral-900/60">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="font-mono text-base font-semibold text-white">{c.code}</span>
        {c.claimed_at ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
            claimed
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            unclaimed · held
          </span>
        )}
        {c.label && <span className="text-xs text-neutral-500">{c.label}</span>}
        <span className="text-xs text-neutral-400">{planLabel(c.plan)}</span>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="text-neutral-400">
            {c.signups} signup{c.signups === 1 ? '' : 's'}
          </span>
          <span className="text-amber-300" title="pending + approved, not yet paid">
            {fmt(c.held_cents, c.currency)} held
          </span>
          <span className="text-emerald-300">{fmt(c.paid_cents, c.currency)} paid</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 px-4 py-2 text-xs">
        <code className="rounded bg-neutral-950 px-2 py-1 text-neutral-300">{link}</code>
        <button
          type="button"
          onClick={() => onCopy(c.code, link)}
          className="text-sky-400 hover:underline"
        >
          {copied === c.code ? 'Copied ✓' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="ml-auto text-neutral-400 hover:text-neutral-200"
        >
          {open ? 'Hide' : 'Details'}
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-neutral-800 p-4">
          {!c.claimed_at && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
              <div className="text-xs font-semibold text-neutral-400">
                Finalize owner (once they’ve signed up)
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  type="email"
                  placeholder="their account email"
                  className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={claim}
                  disabled={claiming || !claimEmail.trim()}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {claiming ? 'Linking…' : 'Link owner'}
                </button>
              </div>
              {claimMsg && <p className="mt-2 text-xs text-neutral-300">{claimMsg}</p>}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-neutral-400">Signups under this code</div>
            {signups === null ? (
              <p className="mt-1 text-xs text-neutral-500">Loading…</p>
            ) : signups.length === 0 ? (
              <p className="mt-1 text-xs text-neutral-500">No signups yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-neutral-300">
                {signups.map((s) => (
                  <li key={s.user_id} className="flex justify-between gap-3">
                    <span className="truncate">{s.email || s.user_id}</span>
                    <span className="shrink-0 text-neutral-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
