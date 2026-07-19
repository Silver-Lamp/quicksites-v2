'use client';

// components/site/neighborhood-stay-booking.tsx
//
// Live booking widget for the neighborhood_stay block when it's bound to a PorchHearth property
// (crosstalk/contracts/neighborhood-stay-embed.md, LIVE). Flow: pick dates + guests → check
// availability (public read proxy, shows a quote) → enter name/email → request booking (POST our
// /api/porchhearth/bookings proxy, which attaches the shared secret + site_ref server-side).
//
// v1 creates a PENDING booking (the API round-trips a Stripe PaymentIntent clientSecret). On-page card
// payment (Stripe Elements) needs PorchHearth's PUBLISHABLE key — a follow-up; v1 confirms the request
// and the host/engine follows up to collect payment. Buyer PII + payment never touch QS.

import * as React from 'react';

type Props = {
  propertyId: string;
  siteRef?: string;
  maxGuests?: number;
  minStay?: number;
  maxStay?: number;
};

type Availability = { available: boolean; nights?: number; quoteCents?: number; reason?: string };

const money = (cents?: number) =>
  typeof cents === 'number' ? `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '';

const nightsBetween = (from: string, to: string): number | null => {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 86_400_000);
};

export default function NeighborhoodStayBooking({ propertyId, siteRef, maxGuests, minStay, maxStay }: Props) {
  const [checkIn, setCheckIn] = React.useState('');
  const [checkOut, setCheckOut] = React.useState('');
  const [guests, setGuests] = React.useState(2);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const [avail, setAvail] = React.useState<Availability | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [booked, setBooked] = React.useState<{ bookingId: string } | null>(null);

  const nights = nightsBetween(checkIn, checkOut);

  const localValidate = (): string | null => {
    if (!checkIn || !checkOut) return 'Pick your check-in and check-out dates.';
    if (nights == null) return 'Check-out must be after check-in.';
    if (minStay && nights < minStay) return `Minimum stay is ${minStay} night${minStay === 1 ? '' : 's'}.`;
    if (maxStay && nights > maxStay) return `Maximum stay is ${maxStay} nights.`;
    if (maxGuests && guests > maxGuests) return `This place sleeps up to ${maxGuests}.`;
    if (guests < 1) return 'At least one guest.';
    return null;
  };

  const checkAvailability = async () => {
    setError(null);
    setAvail(null);
    const v = localValidate();
    if (v) {
      setError(v);
      return;
    }
    setChecking(true);
    try {
      const q = new URLSearchParams({ from: checkIn, to: checkOut, guests: String(guests) });
      const r = await fetch(`/api/porchhearth/properties/${encodeURIComponent(propertyId)}/availability?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Could not check availability.');
      setAvail(j as Availability);
      if (j && j.available === false && j.reason) setError(j.reason);
    } catch (e: any) {
      setError(e?.message || 'Could not check availability.');
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    setError(null);
    const v = localValidate();
    if (v) {
      setError(v);
      return;
    }
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Enter your name and a valid email.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/porchhearth/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(siteRef ? { 'X-QS-Site-Ref': siteRef } : {}) },
        body: JSON.stringify({
          propertyId,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          numberOfGuests: guests,
          buyer: { name: name.trim(), email: email.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) },
          ...(notes.trim() ? { guestNotes: notes.trim() } : {}),
          ...(siteRef ? { siteRef } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        // 409 = an account already exists for that email (buyer should sign in)
        throw new Error(j?.error || 'Could not complete your booking request.');
      }
      setBooked({ bookingId: String(j.bookingId || '') });
    } catch (e: any) {
      setError(e?.message || 'Could not complete your booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <div className="font-semibold">Booking request received 🎉</div>
        <p className="mt-1 text-emerald-100/80">
          You’ll get a confirmation to complete payment and finalize your stay
          {checkIn && checkOut ? ` (${checkIn} → ${checkOut}, ${guests} guest${guests === 1 ? '' : 's'})` : ''}.
        </p>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Check in
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Check out
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Guests
          <input
            type="number"
            min={1}
            max={maxGuests || undefined}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            className={`mt-1 ${inputCls}`}
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={checkAvailability}
            disabled={checking}
            className="w-full rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Check availability'}
          </button>
        </div>
      </div>

      {avail && avail.available && (
        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-300">Available{nights ? ` · ${nights} night${nights === 1 ? '' : 's'}` : ''}</span>
          {avail.quoteCents != null && <span className="font-bold tabular-nums text-emerald-200">{money(avail.quoteCents)} total</span>}
        </div>
      )}

      {/* Guest details — shown once availability is confirmed, else the button still works and validates. */}
      {avail?.available && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          <input placeholder="Anything the host should know? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Requesting…' : `Request to book${avail.quoteCents != null ? ` · ${money(avail.quoteCents)}` : ''}`}
          </button>
        </div>
      )}

      {error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
      <p className="mt-2 text-[11px] text-muted-foreground">Powered by delivered.menu · you won’t be charged until you confirm.</p>
    </div>
  );
}
