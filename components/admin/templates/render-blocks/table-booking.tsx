'use client';

// components/admin/templates/render-blocks/table-booking.tsx
//
// A guest books a table: day → guests → time → name / phone / email → confirmation. The times
// come from GET /api/booking/<templateId>/availability (lib/booking/slots.ts: the smallest free
// table that seats the party), the booking from POST …/book, and the database's exclusion
// constraint settles a race with "that time was just taken". Every word is from
// lib/booking/i18n.ts in the site's locale (Italian for the Italy demo).
//
// ⚠️ RENDERS NOTHING IN PUBLIC until the site has bookable windows (meta.booking or an hours
// block) — an empty booking form under a real restaurant's name invites a guest to a table that
// cannot be booked. The editor sees a hint instead (the products_grid rule).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';
import { bookingSettingsFrom, hasBookableWindows } from '@/lib/booking/settings';
import { bookingStrings, longDate } from '@/lib/booking/i18n';
import { bookableDates } from '@/lib/booking/slots';

type Props = { block?: Block; content?: Block['content']; template?: any; previewOnly?: boolean };
type SlotView = { starts_at: string; ends_at: string; table_id: string; label: string; time: string };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';

export default function RenderTableBooking({ block, content, template, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const templateId: string | null = template?.id ?? null;
  const settings = React.useMemo(() => bookingSettingsFrom(template?.data ?? template ?? {}), [template]);
  const t = bookingStrings(settings.locale);
  const dates = React.useMemo(() => bookableDates(settings), [settings]);
  const ready = !!templateId && hasBookableWindows(settings) && dates.length > 0;

  const [date, setDate] = React.useState<string>('');
  const [party, setParty] = React.useState<number>(2);
  const [slots, setSlots] = React.useState<SlotView[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [chosen, setChosen] = React.useState<SlotView | null>(null);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ time: string; dateLong: string; party: number; table: string } | null>(null);

  React.useEffect(() => {
    if (!date && dates[0]) setDate(dates[0]);
  }, [dates, date]);

  React.useEffect(() => {
    if (!ready || !date || previewOnly) return;
    let alive = true;
    setLoading(true);
    setChosen(null);
    fetch(`/api/booking/${templateId}/availability?date=${encodeURIComponent(date)}&party=${party}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSlots(Array.isArray(j?.slots) ? j.slots : []);
      })
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ready, templateId, date, party, previewOnly]);

  if (!ready) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="text-base">🍽️</div>
        Table booking — add opening windows (meta.booking or an Hours block) and tables, and the booking form appears here. Nothing shows on your live site until you do.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/booking/${templateId}/book`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date, party, starts_at: chosen.starts_at, table_id: chosen.table_id, name, phone, email, notes }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 || j?.error === 'taken') {
        setError(t.taken);
        setChosen(null);
        setSlots(null);
        // Re-fetch so the taken time disappears.
        const a = await fetch(`/api/booking/${templateId}/availability?date=${encodeURIComponent(date)}&party=${party}`, { cache: 'no-store' }).then((x) => x.json()).catch(() => ({ slots: [] }));
        setSlots(Array.isArray(a?.slots) ? a.slots : []);
        return;
      }
      if (!r.ok || !j?.ok) {
        setError(t.failed);
        return;
      }
      setDone({ time: chosen.time, dateLong: longDate(date, settings.locale, settings.tz), party, table: chosen.label });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const tooBig = party > settings.maxParty;
  const title = s(c.title) || t.title;
  const intro = s(c.intro) || t.intro;

  return (
    <section id="book" className="py-10">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{intro}</p>

      {done ? (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="text-lg font-semibold text-foreground">{t.confirmedTitle}</div>
          <p className="mt-1 text-sm text-foreground">{t.confirmed(done)}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.date}</span>
              <select className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} disabled={previewOnly}>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {longDate(d, settings.locale, settings.tz)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-foreground">{t.party}</span>
              <select className={inputCls} value={party} onChange={(e) => setParty(Number(e.target.value))} disabled={previewOnly}>
                {Array.from({ length: settings.maxParty + 1 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === settings.maxParty + 1 ? `${n}+` : n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tooBig ? (
            <p className="text-sm text-muted-foreground">
              {t.tooBig}{' '}
              {settings.phone ? (
                <a href={`tel:${settings.phone.replace(/[^0-9+]/g, '')}`} className="font-semibold text-foreground underline underline-offset-4">
                  {t.call} {settings.phone}
                </a>
              ) : null}
            </p>
          ) : (
            <div>
              <div className="mb-1 text-sm font-medium text-foreground">{t.time}</div>
              {previewOnly ? (
                <p className="text-sm text-muted-foreground">19:00 · 19:30 · 20:00 · 20:30 …</p>
              ) : loading || slots === null ? (
                <p className="text-sm text-muted-foreground">{t.loading}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noTimes}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((sl) => (
                    <button
                      key={`${sl.starts_at}-${sl.table_id}`}
                      type="button"
                      onClick={() => setChosen(sl)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${chosen?.starts_at === sl.starts_at ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary'}`}
                    >
                      {sl.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {chosen && !tooBig ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} required maxLength={80} />
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} required maxLength={32} inputMode="tel" />
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} type="email" maxLength={120} />
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notes} maxLength={200} />
              <button type="submit" disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2">
                {busy ? t.booking : `${t.submit} · ${chosen.time}`}
              </button>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
