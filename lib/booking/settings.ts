// lib/booking/settings.ts
//
// A restaurant's booking rules, read from the template (`data.meta.booking`) with the site's own
// `hours` block as the fallback for the windows — so a restaurant that has already typed its
// hours gets bookable windows without typing them twice. Pure: no network.
export type BookingWindow = { open: string; close: string }; // "19:00", "22:30"
export type BookingSettings = {
  /** IANA zone the restaurant lives in. */
  tz: string;
  /** Per weekday (mon..sun), the windows a seating may START in. Empty = closed. */
  windows: Record<WeekdayKey, BookingWindow[]>;
  /** How long a seating holds the table. */
  seatingMinutes: number;
  /** Slot granularity offered to the guest. */
  slotMinutes: number;
  /** Nothing bookable sooner than this. */
  leadMinutes: number;
  /** Largest party the widget offers (bigger = "call us"). */
  maxParty: number;
  /** ISO dates the restaurant is closed. */
  closedDates: string[];
  /** 'it' | 'en' — the widget and emails speak this. */
  locale: 'it' | 'en';
  /** Shown to a guest when a party is too big or no slot fits. */
  phone: string | null;
  /**
   * `table` (a restaurant: tables, parties, lunch/dinner) or `appointment` (ONE provider — an
   * organizer, a consultant: the party is always one, the "table" is the person, times group as
   * morning/afternoon). Same engine, same rows; the vocabulary and the guests picker change.
   * Katie Bee's organizing site (2026-10-19) is the first.
   */
  mode: BookingMode;
  /**
   * A PREVIEW site: the widget runs end to end but no booking is written and the route refuses
   * one — for an unclaimed spec site whose hours are placeholders the business never set. Nothing
   * may be booked against availability a person did not give us. Cleared when the owner claims
   * and sets real hours.
   */
  preview: boolean;
};

export type BookingMode = 'table' | 'appointment';

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const emptyWindows = (): Record<WeekdayKey, BookingWindow[]> => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const validWindow = (w: unknown): w is BookingWindow =>
  !!w && typeof w === 'object' && HHMM.test(String((w as BookingWindow).open ?? '')) && HHMM.test(String((w as BookingWindow).close ?? '')) && String((w as BookingWindow).open) < String((w as BookingWindow).close);

/** The `hours` block's `days[]` → booking windows, when meta.booking has none. */
export function windowsFromHoursBlock(data: any): Record<WeekdayKey, BookingWindow[]> | null {
  const out = emptyWindows();
  let found = false;
  for (const pg of data?.pages ?? []) {
    for (const b of pg?.blocks ?? pg?.content_blocks ?? []) {
      if (b?.type !== 'hours') continue;
      const days = b?.content?.days ?? b?.props?.days ?? [];
      for (const d of days) {
        const key = String(d?.key ?? '').toLowerCase() as WeekdayKey;
        if (!WEEKDAYS.includes(key) || d?.closed) continue;
        const periods = (Array.isArray(d?.periods) ? d.periods : []).filter(validWindow);
        if (periods.length) {
          out[key] = periods.map((p: BookingWindow) => ({ open: p.open, close: p.close }));
          found = true;
        }
      }
      return found ? out : null;
    }
  }
  return null;
}

export function bookingSettingsFrom(data: any): BookingSettings {
  const b = data?.meta?.booking ?? {};
  const windows = emptyWindows();
  let any = false;
  if (b.windows && typeof b.windows === 'object') {
    for (const k of WEEKDAYS) {
      const list = Array.isArray(b.windows[k]) ? b.windows[k].filter(validWindow) : [];
      windows[k] = list.map((w: BookingWindow) => ({ open: w.open, close: w.close }));
      if (list.length) any = true;
    }
  }
  const fromHours = any ? null : windowsFromHoursBlock(data);
  const localeRaw = String(b.locale ?? data?.meta?.locale ?? '').toLowerCase();
  const phone = String(b.phone ?? data?.meta?.contact?.phone ?? '').trim() || null;
  const mode: BookingMode = b.mode === 'appointment' ? 'appointment' : 'table';
  return {
    mode,
    preview: b.preview === true,
    tz: typeof b.tz === 'string' && b.tz ? b.tz : typeof data?.meta?.contact?.tz === 'string' ? data.meta.contact.tz : 'Europe/Rome',
    windows: fromHours ?? windows,
    seatingMinutes: clampInt(b.seating_minutes, 30, 240, 90),
    slotMinutes: clampInt(b.slot_minutes, 5, 60, 15),
    leadMinutes: clampInt(b.lead_minutes, 0, 1440, 60),
    // One provider books one person at a time; a stored max_party on an appointment site is ignored.
    maxParty: mode === 'appointment' ? 1 : clampInt(b.max_party, 1, 40, 8),
    closedDates: Array.isArray(b.closed_dates) ? b.closed_dates.filter((d: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))) : [],
    locale: localeRaw === 'it' ? 'it' : 'en',
    phone,
  };
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

/** True when at least one weekday has a window — the widget renders nothing otherwise. */
export function hasBookableWindows(s: BookingSettings): boolean {
  return WEEKDAYS.some((k) => s.windows[k].length > 0);
}
