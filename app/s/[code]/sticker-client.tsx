// app/s/[code]/sticker-client.tsx
'use client';

import { useMemo, useState } from 'react';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import { buildPayLinks, type PaymentHandles } from '@/lib/garageSales/payLinks';

/* ─────────────────────────── Activation (the seller) ─────────────────────────── */

/** Local datetime string for an <input type="datetime-local">. */
function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function defaultWindow() {
  // Most stickers are handed over in the days before a weekend sale. Default to the next
  // Saturday 8am–2pm so the common case is two taps, not a date-picker exercise.
  const d = new Date();
  const daysToSat = (6 - d.getDay() + 7) % 7 || 7;
  const start = new Date(d);
  start.setDate(d.getDate() + daysToSat);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(14, 0, 0, 0);
  return { start, end };
}

export function ActivateForm({ code }: { code: string }) {
  const win = useMemo(defaultWindow, []);
  const [form, setForm] = useState({
    title: '',
    addressLine: '',
    city: '',
    state: '',
    startsAt: localInput(win.start),
    endsAt: localInput(win.end),
    venmo: '',
    cashapp: '',
    paypal: '',
    exact: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Anonymous session so the seller is running immediately — no account, no password, no
      // email round-trip while they're standing in a driveway.
      await ensureGuestSession();
      const res = await fetch('/api/garage-sales/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          title: form.title,
          addressLine: form.addressLine,
          city: form.city,
          state: form.state,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          addressPrecision: form.exact ? 'exact' : 'block',
          handles: { venmo: form.venmo, cashapp: form.cashapp, paypal: form.paypal },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not set up the sale.');
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
      setBusy(false);
    }
  }

  const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground';

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-left">
      <div>
        <label className="text-sm font-medium">What are you selling?</label>
        <input className={field} placeholder="Multi-family garage sale" value={form.title} onChange={set('title')} required />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Starts</label>
          <input type="datetime-local" className={field} value={form.startsAt} onChange={set('startsAt')} required />
        </div>
        <div>
          <label className="text-sm font-medium">Ends</label>
          <input type="datetime-local" className={field} value={form.endsAt} onChange={set('endsAt')} required />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Address</label>
        <input className={field} placeholder="412 Elm St" value={form.addressLine} onChange={set('addressLine')} />
        <div className="mt-2 grid grid-cols-3 gap-3">
          <input className={`${field} col-span-2`} placeholder="City" value={form.city} onChange={set('city')} />
          <input className={field} placeholder="State" value={form.state} onChange={set('state')} />
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1" checked={form.exact} onChange={set('exact')} />
          <span>
            Show my full address right away. Otherwise we list the block only
            (&ldquo;400 block of Elm St&rdquo;) until your sale starts, then show the number.
          </span>
        </label>
      </div>

      <div>
        <label className="text-sm font-medium">How should people pay you?</label>
        <p className="text-xs text-muted-foreground">
          Your own accounts — the money goes straight to you and we never touch it. Add any you use.
        </p>
        <div className="mt-2 space-y-2">
          <input className={field} placeholder="Venmo username" value={form.venmo} onChange={set('venmo')} />
          <input className={field} placeholder="Cash App $cashtag" value={form.cashapp} onChange={set('cashapp')} />
          <input className={field} placeholder="PayPal.me username" value={form.paypal} onChange={set('paypal')} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Setting up…' : 'Set up my sale'}
      </button>
    </form>
  );
}

/* ─────────────────────────── Ring-up (the shopper) ─────────────────────────── */

export function RingUp({ handles, saleTitle }: { handles: PaymentHandles; saleTitle: string }) {
  const [amount, setAmount] = useState('');
  const cents = Math.round((parseFloat(amount) || 0) * 100);
  const links = buildPayLinks(handles, cents > 0 ? cents : null, saleTitle);

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <h3 className="text-lg font-semibold">Pay for what you picked</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Agree a total with the seller, type it in, and tap how you want to pay.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-2xl font-semibold">$</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.00"
          className="w-full rounded-lg border border-border bg-background px-3 py-3 text-2xl tabular-nums text-foreground"
          aria-label="Total to pay"
        />
      </div>

      <div className="mt-4 grid gap-2">
        {links.map((l) => (
          <a
            key={l.provider}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <span>Pay with {l.label}</span>
            {cents > 0 && <span className="tabular-nums">${(cents / 100).toFixed(2)}</span>}
          </a>
        ))}
      </div>

      {/* ⚠️ The amount is shown here as TEXT, not only inside the link. Some of these apps ignore
          a pre-filled amount depending on platform and whether the app is installed, and a buyer
          who lands on a blank payment screen needs to know what to type. */}
      {cents > 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          If the app doesn’t fill it in, send <strong className="text-foreground">${(cents / 100).toFixed(2)}</strong>.
        </p>
      )}
      {links.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          This seller hasn’t added a payment method — cash only.
        </p>
      )}
    </div>
  );
}
