'use client';

// app/partners/dashboard/reps.tsx
//
// "Your reps" — the partner mints a code for a sales rep and hands them two links: their own
// page (/for/<code>, the live restaurants table with build + text buttons) and their referral
// link. The rep's orders land on the PARTNER's ledger (lib/partners/repCodes.ts); the table shows
// which rep brought what so the partner can pay them.
import { useCallback, useEffect, useState } from 'react';

type Rep = { code: string; name: string; email: string | null; city: string | null; region: string | null; signups: number; accruedCents: number; pageUrl: string; refLink: string };

const money = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((c || 0) / 100);

export default function RepsCard() {
  const [reps, setReps] = useState<Rep[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/partners/reps', { cache: 'no-store' });
      const j = await r.json();
      if (j?.ok) setReps(j.reps as Rep[]);
    } catch {
      /* leave null → "could not load" */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/partners/reps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, city, region }) });
      const j = await r.json();
      if (!j?.ok) setError(j?.error ?? 'Could not add the rep.');
      else {
        setReps(j.reps as Rep[]);
        setName('');
        setEmail('');
        setCity('');
        setRegion('');
      }
    } catch {
      setError('Could not add the rep.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked; the text is visible anyway */
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="text-sm font-medium">Your reps</div>
      <p className="mb-3 mt-1 text-xs text-zinc-400">
        Add a rep and hand them their page. Everything a rep brings in is recorded against their code and paid to
        you; you pay the rep on the terms you agree with them.
      </p>

      {reps === null ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : reps.length === 0 ? (
        <p className="text-xs text-zinc-500">No reps yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Rep</th>
                <th className="py-1 pr-3">Code</th>
                <th className="py-1 pr-3">Where</th>
                <th className="py-1 pr-3 text-right">Signups</th>
                <th className="py-1 pr-3 text-right">Accrued</th>
                <th className="py-1">Links</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => (
                <tr key={r.code} className="border-t border-zinc-800">
                  <td className="py-2 pr-3">
                    <div className="text-zinc-100">{r.name}</div>
                    {r.email ? <div className="text-xs text-zinc-500">{r.email}</div> : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-300">{r.code}</td>
                  <td className="py-2 pr-3 text-zinc-400">{r.city ? `${r.city}${r.region ? `, ${r.region}` : ''}` : '—'}</td>
                  <td className="py-2 pr-3 text-right text-zinc-300">{r.signups}</td>
                  <td className="py-2 pr-3 text-right text-zinc-300">{money(r.accruedCents)}</td>
                  <td className="py-2 text-xs">
                    <button type="button" onClick={() => copy(r.pageUrl, `${r.code}:page`)} className="mr-2 rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500">
                      {copied === `${r.code}:page` ? 'Copied' : 'Copy their page'}
                    </button>
                    <button type="button" onClick={() => copy(r.refLink, `${r.code}:ref`)} className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500">
                      {copied === `${r.code}:ref` ? 'Copied' : 'Copy their link'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={add} className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rep's name" required className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-1" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-1" />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City they walk" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-1" />
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region / country" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-1" />
        <button type="submit" disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60 sm:col-span-1">
          {busy ? 'Adding…' : 'Add a rep'}
        </button>
      </form>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <p className="mt-2 text-xs text-zinc-500">
        The rep&apos;s page lists the restaurants in their city with a site and no online ordering, and lets them build
        an ordering page and text the owner from a row. Their code rides every link on it.
      </p>
    </div>
  );
}
