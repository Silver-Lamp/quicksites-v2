'use client';

// components/merchant/bookings-client.tsx — the owner's phone view of a day's bookings.
// Reads GET /api/booking/<id>/day, writes POST …/phone and …/cancel. Day tabs: tonight,
// tomorrow, then a date picker. Admin chrome is always dark; semantic tokens only.

import * as React from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';
import { bookingStrings, longDate, type BookingLocale } from '@/lib/booking/i18n';

type TableInfo = { id: string; label: string; seats: number };
type Booking = { id: string; table_id: string; party_size: number; starts_at: string; ends_at: string; guest_name: string; guest_phone: string | null; status: string; source: string; notes: string | null };

const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';

export default function BookingsClient({ templateId, locale, tz, tables, maxParty }: { templateId: string; locale: BookingLocale; tz: string; tables: TableInfo[]; maxParty: number }) {
  const t = bookingStrings(locale);
  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
  const tomorrow = formatInTimeZone(addDays(new Date(), 1), tz, 'yyyy-MM-dd');
  const [date, setDate] = React.useState(today);
  const [rows, setRows] = React.useState<Booking[] | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ time: '20:00', party: 2, table_id: '', name: '', phone: '', notes: '' });
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await fetch(`/api/booking/${templateId}/day?date=${date}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    setRows(Array.isArray(j?.bookings) ? j.bookings : []);
  }, [templateId, date]);

  React.useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm(`${t.cancel}?`)) return;
    await fetch(`/api/booking/${templateId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ booking_id: id }) });
    load();
  }
  async function mark(id: string, status: 'seated' | 'no_show' | 'booked') {
    await fetch(`/api/booking/${templateId}/cancel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ booking_id: id, status }) });
    load();
  }
  async function addPhone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/booking/${templateId}/phone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, time: form.time, party: form.party, table_id: form.table_id || undefined, name: form.name, phone: form.phone, notes: form.notes }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(j?.error === 'taken' || j?.error === 'not_available' ? t.taken : t.failed);
        return;
      }
      setAdding(false);
      setForm({ time: '20:00', party: 2, table_id: '', name: '', phone: '', notes: '' });
      load();
    } finally {
      setBusy(false);
    }
  }

  const tableLabel = (id: string) => tables.find((x) => x.id === id)?.label ?? '?';
  const live = (rows ?? []).filter((b) => b.status !== 'cancelled');
  const cancelled = (rows ?? []).filter((b) => b.status === 'cancelled');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          [today, t.tonight],
          [tomorrow, t.tomorrow],
        ].map(([d, label]) => (
          <button key={d} type="button" onClick={() => setDate(d)} className={`rounded-full border px-3 py-1.5 text-sm ${date === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'}`}>
            {label}
          </button>
        ))}
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
        <span className="text-sm text-muted-foreground">{longDate(date, locale, tz)}</span>
      </div>

      <div className="mt-5 space-y-2">
        {rows === null ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : live.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.none}</p>
        ) : (
          live.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-card-foreground">
              <div className="w-14 font-mono text-base font-semibold">{formatInTimeZone(new Date(b.starts_at), tz, 'HH:mm')}</div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {b.guest_name} · {t.guests(b.party_size)} · {t.table} {tableLabel(b.table_id)}
                  {b.source === 'phone' ? <span className="ml-2 text-xs text-muted-foreground">({t.byPhone})</span> : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.guest_phone ? <a href={`tel:${b.guest_phone.replace(/[^0-9+]/g, '')}`} className="underline underline-offset-2">{b.guest_phone}</a> : null}
                  {b.notes ? ` · ${b.notes}` : ''}
                  {b.status === 'seated' ? ` · ${t.seated}` : ''}
                </div>
              </div>
              {b.status !== 'seated' ? (
                <button type="button" onClick={() => mark(b.id, 'seated')} className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-foreground">
                  {t.seated}
                </button>
              ) : null}
              <button type="button" onClick={() => cancel(b.id)} className="rounded-full border border-rose-500/40 px-3 py-1 text-xs text-foreground">
                {t.cancel}
              </button>
            </div>
          ))
        )}
        {cancelled.length ? <p className="pt-1 text-xs text-muted-foreground">{t.cancelled}: {cancelled.map((b) => `${formatInTimeZone(new Date(b.starts_at), tz, 'HH:mm')} ${b.guest_name}`).join(' · ')}</p> : null}
      </div>

      <div className="mt-6">
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            + {t.addPhone}
          </button>
        ) : (
          <form onSubmit={addPhone} className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">{t.time}</span>
              <input className={inputCls} type="time" step={900} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">{t.party}</span>
              <select className={inputCls} value={form.party} onChange={(e) => setForm({ ...form, party: Number(e.target.value) })}>
                {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">{t.table}</span>
              <select className={inputCls} value={form.table_id} onChange={(e) => setForm({ ...form, table_id: e.target.value })}>
                <option value="">—</option>
                {tables.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} ({x.seats})
                  </option>
                ))}
              </select>
            </label>
            <input className={inputCls} placeholder={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
            <input className={inputCls} placeholder={t.phone} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={32} inputMode="tel" />
            <input className={inputCls} placeholder={t.notes} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={200} />
            <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
              <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? t.booking : t.submit}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="text-sm text-muted-foreground underline underline-offset-4">
                {t.cancel}
              </button>
              {msg ? <span className="text-sm text-rose-400">{msg}</span> : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
