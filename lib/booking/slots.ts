// lib/booking/slots.ts
//
// Which times a party can book on a date, and at which table. Pure: settings + tables + the
// day's bookings in, slots out. The database's exclusion constraint is the referee for the
// race (two guests picking the same slot at once); this is the honest menu of what is free now.
//
// Table choice: the SMALLEST active table that seats the party and is free for the whole
// seating — so a couple is not sat at the eight-top while a party of six is turned away.
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import type { BookingSettings, WeekdayKey } from '@/lib/booking/settings';
import { WEEKDAYS } from '@/lib/booking/settings';

export type TableRow = { id: string; label: string; seats: number; active?: boolean };
export type BookingRange = { table_id: string; starts_at: string; ends_at: string; status: string };
export type Slot = { starts_at: string; ends_at: string; table_id: string; label: string; seats: number; /** "19:30" in the restaurant's zone */ time: string };

/** `YYYY-MM-DD` + `HH:MM` in the restaurant's zone → an instant. */
export function zonedInstant(date: string, hhmm: string, tz: string): Date {
  return fromZonedTime(`${date}T${hhmm}:00`, tz);
}

/** The weekday of a calendar date in the restaurant's zone. */
export function weekdayOf(date: string, tz: string): WeekdayKey {
  const d = toZonedTime(fromZonedTime(`${date}T12:00:00`, tz), tz);
  // getDay(): 0 = Sunday
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as WeekdayKey[])[d.getDay()];
}

const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && bS < aE;

export function computeSlots(input: { date: string; party: number; settings: BookingSettings; tables: TableRow[]; bookings: BookingRange[]; now?: Date }): Slot[] {
  const { date, party, settings } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  if (!Number.isInteger(party) || party < 1 || party > settings.maxParty) return [];
  if (settings.closedDates.includes(date)) return [];
  const wd = weekdayOf(date, settings.tz);
  if (!WEEKDAYS.includes(wd)) return [];
  const windows = settings.windows[wd] ?? [];
  if (!windows.length) return [];
  const now = input.now ?? new Date();
  const earliest = addMinutes(now, settings.leadMinutes);

  const tables = input.tables
    .filter((t) => t.active !== false && t.seats >= party)
    .sort((a, b) => a.seats - b.seats || a.label.localeCompare(b.label));
  if (!tables.length) return [];
  const live = input.bookings.filter((b) => b.status !== 'cancelled').map((b) => ({ table_id: b.table_id, s: new Date(b.starts_at), e: new Date(b.ends_at) }));

  const out: Slot[] = [];
  for (const w of windows) {
    const open = zonedInstant(date, w.open, settings.tz);
    const close = zonedInstant(date, w.close, settings.tz);
    for (let t = open; t < close; t = addMinutes(t, settings.slotMinutes)) {
      const end = addMinutes(t, settings.seatingMinutes);
      // A seating may run past the window's close (the kitchen closes at 22:30, the last table
      // sits at 22:30 and stays), but it must START inside the window.
      if (t < earliest) continue;
      const table = tables.find((tb) => !live.some((b) => b.table_id === tb.id && overlaps(t, end, b.s, b.e)));
      if (!table) continue;
      out.push({ starts_at: t.toISOString(), ends_at: end.toISOString(), table_id: table.id, label: table.label, seats: table.seats, time: formatInTimeZone(t, settings.tz, 'HH:mm') });
    }
  }
  return out;
}

export type Service = 'lunch' | 'dinner';
export type DayTime = { time: string; starts_at: string; service: Service };

/**
 * A window opening before 16:00 is lunch; later is dinner. The widget groups chips by this.
 * In appointment mode the same two groups are MORNING (before noon) and AFTERNOON — the strings
 * overlay renames them; the engine keeps one pair of names.
 */
export function serviceOf(w: { open: string }, mode: BookingSettings['mode'] = 'table'): Service {
  const split = mode === 'appointment' ? '12:00' : '16:00';
  return String(w.open) < split ? 'lunch' : 'dinner';
}

/**
 * EVERY bookable start on a date — free or not — so the widget can show a full time as "full"
 * instead of silently omitting it. HiveJournal's sweep (2026-10-15): a guest who wanted 20:15
 * simply did not see it, and could not tell "full" from "not offered". Same loop as
 * `computeSlots`, minus the table search; nothing about other guests is in it.
 */
export function dayTimes(settings: BookingSettings, date: string, now = new Date()): DayTime[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  if (settings.closedDates.includes(date)) return [];
  const wd = weekdayOf(date, settings.tz);
  const windows = settings.windows[wd] ?? [];
  const earliest = addMinutes(now, settings.leadMinutes);
  const out: DayTime[] = [];
  for (const w of windows) {
    const open = zonedInstant(date, w.open, settings.tz);
    const close = zonedInstant(date, w.close, settings.tz);
    const service = serviceOf(w, settings.mode);
    for (let t = open; t < close; t = addMinutes(t, settings.slotMinutes)) {
      if (t < earliest) continue;
      out.push({ time: formatInTimeZone(t, settings.tz, 'HH:mm'), starts_at: t.toISOString(), service });
    }
  }
  return out;
}

/**
 * The dates a guest may pick: today onward, up to `days` ahead, skipping closed ones — and
 * skipping a day whose LAST bookable start is already inside the lead time. With a 24-hour lead
 * (Katie Bee's organizing site, 2026-10-19) "today" was always the first day offered and always
 * read "No free times that day": a true sentence that looks like a broken widget. A day with no
 * start the guest can still take is not a day to offer; `dayTimes` decides the same way.
 */
export function bookableDates(settings: BookingSettings, days = 30, now = new Date()): string[] {
  const out: string[] = [];
  const earliest = addMinutes(now, settings.leadMinutes).getTime();
  const step = settings.slotMinutes * 60_000;
  for (let i = 0; i < days; i++) {
    const d = formatInTimeZone(addMinutes(now, i * 24 * 60), settings.tz, 'yyyy-MM-dd');
    if (settings.closedDates.includes(d)) continue;
    const windows = settings.windows[weekdayOf(d, settings.tz)] ?? [];
    if (!windows.length) continue;
    const lastStart = Math.max(
      ...windows.map((w) => {
        const open = zonedInstant(d, w.open, settings.tz).getTime();
        const close = zonedInstant(d, w.close, settings.tz).getTime();
        return open + Math.floor((close - open - 1) / step) * step; // the last grid point before close
      }),
    );
    if (lastStart < earliest) continue;
    out.push(d);
  }
  return out;
}
