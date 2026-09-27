'use client';

// components/partners/calculator-email-capture.tsx
//
// "Send me these numbers" on the partner earnings calculator.
//
// ⚠️ IT ASKS, IT DOES NOT GATE, and that distinction is the whole design. The result is already
// on screen above this form and stays there whatever the visitor does. Hiding a number someone
// just modelled measures how badly they want it back, not whether the offer is any good — and
// since this page's only job is to tell an interested reseller from a bounce, gating would
// poison the one signal it produces.
//
// ⚠️ The MODELLED FIGURES travel with the email. An address alone is a name on a list; an
// address beside "40 merchants, $18k average GMV, $46k/yr modelled" is a reply that needs no
// discovery call. The visitor can see exactly what is being sent — it is rendered in the
// confirmation line, not collected invisibly.
import { useState } from 'react';

type Props = {
  merchants: number;
  avgGmv: number;
  /** Modelled monthly residual, already computed and displayed above. */
  monthly: number;
};

export default function CalculatorEmailCapture({ merchants, avgGmv, monthly }: Props) {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      const r = await fetch('/api/partners/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, company, merchants, avgGmv, monthly }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j?.error || 'Could not save that — try again.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setError('Network error — try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
        <p className="text-sm font-medium text-emerald-300">Got it — we’ll be in touch.</p>
        <p className="mt-1 text-xs text-zinc-400">
          Saved against {merchants} merchants at ${avgGmv.toLocaleString()} average monthly sales.
          Nothing is sent to your merchants, and you are not signed up for anything.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <label htmlFor="partner-email" className="block text-sm font-medium text-zinc-200">
        Want these numbers walked through with you?
      </label>
      <p className="mt-1 text-xs text-zinc-500">
        Leave an email and we’ll send this scenario over. The calculator keeps working either way
        — nothing above is hidden.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="partner-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-sky-500 focus:outline-none"
        />
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company (optional)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-sky-500 focus:outline-none sm:max-w-[45%]"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="shrink-0 rounded-lg bg-sky-500 px-5 py-2 text-sm font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {state === 'sending' ? 'Sending…' : 'Send it'}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </form>
  );
}
