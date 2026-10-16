// lib/booking/ics.ts
//
// A booking as a calendar file the guest can save from the confirmation ("Aggiungi al
// calendario" — HiveJournal's UX sweep, 2026-10-15). Pure: strings in, an iCalendar text out.
// Times are UTC instants (`starts_at` / `ends_at` from the booking row), so a phone shows them in
// its own zone — which for a guest in Italy is the restaurant's.

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-20T18:45:00.000Z` → `20261020T184500Z`. */
export function icsStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, newline. */
export function icsText(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function bookingIcs(input: { uid: string; title: string; startsAt: string; endsAt: string; location?: string | null; description?: string | null; url?: string | null }): string {
  const start = icsStamp(input.startsAt);
  const end = icsStamp(input.endsAt);
  if (!start || !end) return '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QuickSites//Table booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(input.uid)}@quicksites.ai`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsText(input.title)}`,
    input.location ? `LOCATION:${icsText(input.location)}` : null,
    input.description ? `DESCRIPTION:${icsText(input.description)}` : null,
    input.url ? `URL:${icsText(input.url)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => !!l);
  return lines.join('\r\n') + '\r\n';
}

/** A `data:` href for an `<a download>` — no route, no storage, the file is the link. */
export function icsDataHref(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
