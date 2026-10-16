/**
 * @jest-environment node
 */
// HiveJournal's guest-side UX sweep of the booking widget (2026-10-15): full times shown as
// full, times grouped by service, a confirmation that is brought into view and carries a
// reference + calendar file, labelled fields with a local phone example, and the chrome around
// the site (footer headings, the "Hear this page" pill) speaking the site's language.
import fs from 'node:fs';
import path from 'node:path';
import { bookingSettingsFrom } from '@/lib/booking/settings';
import { computeSlots, dayTimes, serviceOf } from '@/lib/booking/slots';
import { bookingIcs, icsDataHref, icsStamp, icsText } from '@/lib/booking/ics';
import { bookingReference } from '@/lib/booking/reference';
import { bookingStrings } from '@/lib/booking/i18n';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const settings = bookingSettingsFrom({
  meta: { booking: { tz: 'Europe/Rome', windows: { fri: [{ open: '12:00', close: '14:00' }, { open: '19:00', close: '21:00' }] }, seating_minutes: 90, slot_minutes: 30, lead_minutes: 0, max_party: 8, closed_dates: [], locale: 'it', phone: '+39 0123 456789' } },
});
const FRI = '2026-10-23';
const now = new Date('2026-10-20T10:00:00Z');

describe('dayTimes — every bookable start, free or not', () => {
  it('lists each slot in each window with its service', () => {
    const times = dayTimes(settings, FRI, now);
    expect(times.map((x) => `${x.service}:${x.time}`)).toEqual(['lunch:12:00', 'lunch:12:30', 'lunch:13:00', 'lunch:13:30', 'dinner:19:00', 'dinner:19:30', 'dinner:20:00', 'dinner:20:30']);
  });
  it('is the superset of computeSlots: a fully booked time is still listed, so the widget can mark it full', () => {
    const tables = [{ id: 'A', label: '1', seats: 2 }];
    const taken = computeSlots({ date: FRI, party: 2, settings, tables, bookings: [], now }).find((s) => s.time === '20:00')!;
    const slots = computeSlots({ date: FRI, party: 2, settings, tables, bookings: [{ table_id: 'A', starts_at: taken.starts_at, ends_at: taken.ends_at, status: 'booked' }], now });
    const free = new Set(slots.map((s) => s.starts_at));
    const all = dayTimes(settings, FRI, now);
    expect(all.some((x) => x.time === '20:00')).toBe(true);
    expect(free.has(taken.starts_at)).toBe(false);
    for (const s of slots) expect(all.some((x) => x.starts_at === s.starts_at)).toBe(true);
  });
  it('closed days and the lead time apply the same way', () => {
    expect(dayTimes(settings, '2026-10-24', now)).toEqual([]); // saturday: no windows
    const late = new Date('2026-10-23T11:45:00Z'); // 13:45 Rome
    expect(dayTimes(settings, FRI, late).map((x) => x.time)).toEqual(['19:00', '19:30', '20:00', '20:30']);
  });
  it('serviceOf: before 16:00 is lunch', () => {
    expect(serviceOf({ open: '12:00' })).toBe('lunch');
    expect(serviceOf({ open: '15:59' })).toBe('lunch');
    expect(serviceOf({ open: '16:00' })).toBe('dinner');
  });
});

describe('the calendar file and the reference', () => {
  it('bookingIcs: a valid VEVENT with escaped text and UTC stamps', () => {
    const ics = bookingIcs({ uid: 'abc', title: 'Trattoria; del Borgo · Tavolo 3', startsAt: '2026-10-20T18:45:00.000Z', endsAt: '2026-10-20T20:15:00.000Z', location: 'Via del Borgo 12, San Gimignano', description: 'Codice: ABCDEF12' });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('DTSTART:20261020T184500Z');
    expect(ics).toContain('DTEND:20261020T201500Z');
    expect(ics).toContain('SUMMARY:Trattoria\\; del Borgo · Tavolo 3');
    expect(ics).toContain('LOCATION:Via del Borgo 12\\, San Gimignano');
    expect(ics).toContain('UID:abc@quicksites.ai');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(icsDataHref(ics)).toMatch(/^data:text\/calendar;charset=utf-8,BEGIN/);
  });
  it('an unparseable time yields no file rather than a wrong one', () => {
    expect(bookingIcs({ uid: 'x', title: 't', startsAt: 'nope', endsAt: '2026-10-20T20:15:00Z' })).toBe('');
    expect(icsStamp('nope')).toBe('');
    expect(icsText('a\nb')).toBe('a\\nb');
  });
  it('bookingReference: 8 upper hex from the id', () => {
    expect(bookingReference('a19a2920-1234-4abc-9def-000000000000')).toBe('A19A2920');
    expect(bookingReference('')).toBe('');
  });
});

describe('the strings exist in both languages', () => {
  it.each(['phoneWhy', 'lunch', 'dinner', 'full', 'dayFull', 'reference', 'addToCalendar', 'changeByPhone', 'changeNoPhone'] as const)('%s', (k) => {
    expect(String(bookingStrings('it')[k])).not.toBe('');
    expect(String(bookingStrings('en')[k])).not.toBe('');
    expect(bookingStrings('it')[k]).not.toBe(bookingStrings('en')[k]);
  });
  it('serviceFull / emailSent take an argument', () => {
    expect(bookingStrings('it').serviceFull('Cena')).toMatch(/^Cena al completo/);
    expect(bookingStrings('it').emailSent('a@b.it')).toContain('a@b.it');
  });
});

describe('source guards — the widget', () => {
  const src = read('components/admin/templates/render-blocks/table-booking.tsx');
  it('the confirmation is brought into view, focusable, and announced', () => {
    expect(src).toMatch(/scrollIntoView\(/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/tabIndex=\{-1\}/);
    expect(src).toMatch(/\.focus\(/);
  });
  it('fields carry visible labels and the phone shows a local example with its reason', () => {
    expect(src).toMatch(/phonePlaceholder\(phoneRegionForSite\(template\)\)/);
    expect(src).toMatch(/t\.phoneWhy/);
    expect(src).not.toMatch(/placeholder=\{t\.name\}/);
    expect(src).not.toMatch(/placeholder=\{t\.phone\}/);
    expect(src).toMatch(/autoComplete="tel"/);
  });
  it('full times render disabled and marked full; services get headings; a gone service says so', () => {
    expect(src).toMatch(/title=\{t\.full\}/);
    expect(src).toMatch(/t\.serviceFull\(/);
    expect(src).toMatch(/t\.dayFull/);
    expect(src).toMatch(/j\?\.times/);
  });
  it('the confirmation carries reference, calendar, change-by-phone, and claims an email only off a simulation', () => {
    expect(src).toMatch(/bookingReference\(done\.id\)/);
    expect(src).toMatch(/icsDataHref\(ics\)/);
    expect(src).toMatch(/t\.changeByPhone/);
    expect(src).toMatch(/done\.email && !done\.simulation/);
  });
});

describe('source guards — the availability route returns every time', () => {
  it('times beside slots', () => {
    const src = read('app/api/booking/[templateId]/availability/route.ts');
    expect(src).toMatch(/dayTimes\(site\.settings, date, now\)/);
    expect(src).toMatch(/times,/);
  });
});

describe('source guards — the booking demo is noindex', () => {
  it('the platform route refuses indexing for the italy_table_booking demo by flag, never by slug', () => {
    const src = read('app/sites/[slug]/[[...rest]]/page.tsx');
    expect(src).toMatch(/isLinkExemptDemo\(\{ meta \}\)/);
    expect(src).not.toMatch(/trattoria-del-borgo/);
  });
});
