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
//
// HiveJournal's UX sweep (2026-10-15), walked as a guest on a 390 px phone, changed four things:
//   - the confirmation SCROLLS INTO VIEW and takes focus (aria-live) — before, the form collapsed,
//     the page shifted, and the guest was looking at the menu with no idea it had worked;
//   - every field has a visible label, and the phone shows a LOCAL example with its reason;
//   - a full time is shown disabled and marked "full" rather than silently missing, times are
//     grouped under Lunch / Dinner when the day has both, and a whole service gone says so;
//   - the confirmation carries a reference, a calendar file, how to change it, and whether a
//     confirmation email went out (never claimed on a simulation site — none is sent).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';
import { bookingSettingsFrom, hasBookableWindows } from '@/lib/booking/settings';
import { bookingStrings, longDate } from '@/lib/booking/i18n';
import { bookableDates, type DayTime, type Service } from '@/lib/booking/slots';
import { bookingIcs, icsDataHref } from '@/lib/booking/ics';
import { bookingReference } from '@/lib/booking/reference';
import { phonePlaceholder, phoneRegionForSite } from '@/lib/phone/region';

type Props = { block?: Block; content?: Block['content']; template?: any; previewOnly?: boolean };
type SlotView = { starts_at: string; ends_at: string; table_id: string; label: string; time: string };
type Done = { id: string; time: string; dateLong: string; party: number; table: string; startsAt: string; endsAt: string; email: string | null; simulation: boolean; preview: boolean };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';
const labelCls = 'mb-1 block text-sm font-medium text-foreground';

export default function RenderTableBooking({ block, content, template, previewOnly }: Props) {
  const c: any = content ?? block?.content ?? {};
  const templateId: string | null = template?.id ?? null;
  const settings = React.useMemo(() => bookingSettingsFrom(template?.data ?? template ?? {}), [template]);
  // ONE provider (settings.mode === 'appointment'): the party is one, the guests picker is hidden,
  // and the words are "a time with Katie", not "a table" (lib/booking/i18n.ts overlay).
  const appointment = settings.mode === 'appointment';
  const t = bookingStrings(settings.locale, settings.mode);
  const dates = React.useMemo(() => bookableDates(settings), [settings]);
  const ready = !!templateId && hasBookableWindows(settings) && dates.length > 0;
  const phoneExample = React.useMemo(() => phonePlaceholder(phoneRegionForSite(template)), [template]);
  const restaurantName: string = s(template?.business_name) || s(template?.data?.meta?.business_name) || s(template?.template_name) || '';
  const address: string = s(template?.data?.meta?.contact?.address);

  const [date, setDate] = React.useState<string>('');
  const [party, setParty] = React.useState<number>(appointment ? 1 : 2);
  const [slots, setSlots] = React.useState<SlotView[] | null>(null);
  const [times, setTimes] = React.useState<DayTime[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [chosen, setChosen] = React.useState<SlotView | null>(null);
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Done | null>(null);
  const doneRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!date && dates[0]) setDate(dates[0]);
  }, [dates, date]);

  async function loadAvailability(): Promise<void> {
    const j = await fetch(`/api/booking/${templateId}/availability?date=${encodeURIComponent(date)}&party=${party}`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({ slots: [], times: [] }));
    setSlots(Array.isArray(j?.slots) ? j.slots : []);
    setTimes(Array.isArray(j?.times) ? j.times : []);
  }

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
        setTimes(Array.isArray(j?.times) ? j.times : []);
      })
      .catch(() => {
        if (!alive) return;
        setSlots([]);
        setTimes([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ready, templateId, date, party, previewOnly]);

  // The confirmation replaces a form the guest was looking at; bring it to them and say it aloud.
  React.useEffect(() => {
    if (!done) return;
    const el = doneRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    } catch {}
  }, [done]);

  if (!ready) {
    if (!isEditorContext(previewOnly)) return null;
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="text-base">{appointment ? '📅' : '🍽️'}</div>
        {appointment
          ? 'Appointment booking — add the hours you take bookings (meta.booking or an Hours block) and the form appears here. Nothing shows on your live site until you do.'
          : 'Table booking — add opening windows (meta.booking or an Hours block) and tables, and the booking form appears here. Nothing shows on your live site until you do.'}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    // A PREVIEW site books nothing: the hours are placeholders the business never gave us, so the
    // walk-through ends in a confirmation that says so, and nothing is sent (the route refuses too).
    if (settings.preview) {
      setDone({ id: '', time: chosen.time, dateLong: longDate(date, settings.locale, settings.tz), party, table: chosen.label, startsAt: chosen.starts_at, endsAt: chosen.ends_at, email: null, simulation: false, preview: true });
      return;
    }
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
        // Re-fetch so the taken time shows as full.
        await loadAvailability();
        return;
      }
      if (!r.ok || !j?.ok) {
        setError(t.failed);
        return;
      }
      setDone({
        id: String(j?.booking?.id ?? ''),
        time: chosen.time,
        dateLong: longDate(date, settings.locale, settings.tz),
        party,
        table: chosen.label,
        startsAt: String(j?.booking?.starts_at ?? chosen.starts_at),
        endsAt: String(j?.booking?.ends_at ?? chosen.ends_at),
        email: email.trim() || null,
        simulation: j?.simulation === true,
        preview: false,
      });
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  const tooBig = party > settings.maxParty;
  const title = s(c.title) || t.title;
  const intro = s(c.intro) || t.intro;
  const phoneHref = settings.phone ? `tel:${settings.phone.replace(/[^0-9+]/g, '')}` : null;

  // Times by service, each marked free or full. Grouped under headings only when the day has both.
  const freeByStart = new Map<string, SlotView>((slots ?? []).map((sl) => [sl.starts_at, sl]));
  const services: Service[] = Array.from(new Set(times.map((x) => x.service)));
  const grouped = services.map((svc) => ({ service: svc, label: svc === 'lunch' ? t.lunch : t.dinner, items: times.filter((x) => x.service === svc) }));
  const anyFree = (slots ?? []).length > 0;

  const renderChips = (items: DayTime[]) => (
    <div className="flex flex-wrap gap-2">
      {items.map((x) => {
        const free = freeByStart.get(x.starts_at);
        if (!free) {
          return (
            <button key={x.starts_at} type="button" disabled aria-disabled="true" title={t.full} className="rounded-full border border-border/60 px-3 py-1.5 text-sm text-muted-foreground line-through opacity-60">
              {x.time}
              <span className="sr-only"> — {t.full}</span>
            </button>
          );
        }
        const active = chosen?.starts_at === free.starts_at;
        return (
          <button
            key={x.starts_at}
            type="button"
            onClick={() => setChosen(free)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary'}`}
          >
            {x.time}
          </button>
        );
      })}
    </div>
  );

  const ics = done
    ? bookingIcs({
        uid: done.id || `${done.startsAt}-${done.table}`,
        title: restaurantName ? `${restaurantName} · ${t.table} ${done.table}` : `${t.table} ${done.table}`,
        startsAt: done.startsAt,
        endsAt: done.endsAt,
        location: address || restaurantName || null,
        description: `${t.reference}: ${bookingReference(done.id)}${settings.phone ? ` · ${t.call} ${settings.phone}` : ''}`,
      })
    : '';

  return (
    <section id="book" className="py-10">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
      {settings.preview ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">{t.previewBanner({ name: restaurantName })}</p>
      ) : null}

      {done ? (
        <div ref={doneRef} tabIndex={-1} role="status" aria-live="polite" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="text-lg font-semibold text-foreground">{t.confirmedTitle}</div>
          <p className="mt-1 text-sm text-foreground">{t.confirmed(done)}</p>
          {done.preview ? <p className="mt-1 text-sm font-medium text-amber-300">{t.previewConfirmed}</p> : null}
          {done.id ? (
            <p className="mt-2 text-sm text-foreground">
              {t.reference}: <span className="font-mono font-semibold tracking-wider">{bookingReference(done.id)}</span>
            </p>
          ) : null}
          {done.email && !done.simulation ? <p className="mt-1 text-sm text-muted-foreground">{t.emailSent(done.email)}</p> : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {settings.phone && phoneHref ? (
              <>
                {t.changeByPhone}{' '}
                <a href={phoneHref} className="font-semibold text-foreground underline underline-offset-4">{settings.phone}</a>
              </>
            ) : (
              t.changeNoPhone
            )}
          </p>
          {ics ? (
            <a href={icsDataHref(ics)} download={`${(restaurantName || 'table').replace(/[^\w-]+/g, '-')}.ics`} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary">
              📅 {t.addToCalendar}
            </a>
          ) : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4">
          <div className={`grid gap-3 ${appointment ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <label className="block text-sm">
              <span className={labelCls}>{t.date}</span>
              <select className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} disabled={previewOnly}>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {longDate(d, settings.locale, settings.tz)}
                  </option>
                ))}
              </select>
            </label>
            {appointment ? null : (
              <label className="block text-sm">
                <span className={labelCls}>{t.party}</span>
                <select className={inputCls} value={party} onChange={(e) => setParty(Number(e.target.value))} disabled={previewOnly}>
                  {Array.from({ length: settings.maxParty + 1 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === settings.maxParty + 1 ? `${n}+` : n}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {tooBig ? (
            <p className="text-sm text-muted-foreground">
              {t.tooBig}{' '}
              {settings.phone && phoneHref ? (
                <a href={phoneHref} className="font-semibold text-foreground underline underline-offset-4">
                  {t.call} {settings.phone}
                </a>
              ) : null}
            </p>
          ) : (
            <div>
              <div className={labelCls}>{t.time}</div>
              {previewOnly ? (
                <p className="text-sm text-muted-foreground">{appointment ? '09:00 · 09:30 · 10:00 · 10:30 …' : '19:00 · 19:30 · 20:00 · 20:30 …'}</p>
              ) : loading || slots === null ? (
                <p className="text-sm text-muted-foreground">{t.loading}</p>
              ) : times.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noTimes}</p>
              ) : !anyFree ? (
                <>
                  <p className="text-sm text-muted-foreground">{t.dayFull}</p>
                  <div className="mt-2">{renderChips(times)}</div>
                </>
              ) : grouped.length > 1 ? (
                <div className="space-y-3">
                  {grouped.map((g) => {
                    const freeHere = g.items.some((x) => freeByStart.has(x.starts_at));
                    return (
                      <div key={g.service}>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                        {freeHere ? null : <p className="mb-1 text-sm text-muted-foreground">{t.serviceFull(g.label)}</p>}
                        {renderChips(g.items)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                renderChips(times)
              )}
            </div>
          )}

          {chosen && !tooBig ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>{t.name}</span>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
              </label>
              <label className="block">
                <span className={labelCls}>
                  {t.phone} <span className="font-normal text-muted-foreground">· {t.phoneWhy}</span>
                </span>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={phoneExample} required maxLength={32} inputMode="tel" autoComplete="tel" />
              </label>
              <label className="block">
                <span className={labelCls}>{t.email}</span>
                <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" maxLength={120} autoComplete="email" />
              </label>
              <label className="block">
                <span className={labelCls}>{t.notes}</span>
                <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
              </label>
              <button type="submit" disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2">
                {busy ? t.booking : `${t.submit} · ${chosen.time}`}
              </button>
            </div>
          ) : null}
          {error ? <p className="text-sm text-rose-400" role="alert">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
