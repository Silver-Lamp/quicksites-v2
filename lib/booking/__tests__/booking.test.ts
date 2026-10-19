/**
 * @jest-environment node
 */
// Table booking (the Italy demo). Pure halves: settings from the template (windows from
// meta.booking or the hours block), the slot computation (smallest free table, lead time,
// windows, closed dates), the two-language strings carrying the same keys. Source guards: the
// guest route re-derives the slot and emails only after the row exists; the day endpoint strips
// contact details for a partner; the owner routes are owner-gated.
import fs from 'node:fs';
import path from 'node:path';
import { bookingSettingsFrom, hasBookableWindows, windowsFromHoursBlock } from '@/lib/booking/settings';
import { computeSlots, bookableDates, weekdayOf, zonedInstant, serviceOf } from '@/lib/booking/slots';
import { APPOINTMENT_OVERLAY_KEYS, APPOINTMENT_OVERLAY_KEYS_IT, BOOKING_STRING_KEYS, BOOKING_STRING_KEYS_IT, bookingStrings, longDate } from '@/lib/booking/i18n';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));

const data = {
  meta: {
    booking: { tz: 'Europe/Rome', windows: { fri: [{ open: '12:00', close: '14:30' }, { open: '19:00', close: '22:30' }], sat: [{ open: '19:00', close: '22:30' }] }, seating_minutes: 90, slot_minutes: 30, lead_minutes: 60, max_party: 8, closed_dates: ['2026-10-24'], locale: 'it', phone: '+39 0123 456789' },
  },
};
const settings = bookingSettingsFrom(data);
const tables = [
  { id: 't8', label: 'Sala 8', seats: 8 },
  { id: 't2', label: 'T2', seats: 2 },
  { id: 't4', label: 'T4', seats: 4 },
];
// 2026-10-16 is a Friday.
const now = new Date('2026-10-16T08:00:00Z');

describe('settings', () => {
  it('reads meta.booking with clamps and defaults', () => {
    expect(settings.tz).toBe('Europe/Rome');
    expect(settings.windows.fri).toHaveLength(2);
    expect(settings.windows.mon).toEqual([]);
    expect(settings.locale).toBe('it');
    expect(settings.seatingMinutes).toBe(90);
    expect(hasBookableWindows(settings)).toBe(true);
    expect(bookingSettingsFrom({}).locale).toBe('en');
    expect(hasBookableWindows(bookingSettingsFrom({}))).toBe(false);
  });
  it('falls back to the hours block when meta.booking has no windows', () => {
    const d = { pages: [{ blocks: [{ type: 'hours', content: { days: [{ key: 'tue', closed: false, periods: [{ open: '18:00', close: '22:00' }] }, { key: 'wed', closed: true, periods: [{ open: '18:00', close: '22:00' }] }] } }] }] };
    expect(windowsFromHoursBlock(d)?.tue).toEqual([{ open: '18:00', close: '22:00' }]);
    expect(windowsFromHoursBlock(d)?.wed).toEqual([]);
    expect(bookingSettingsFrom(d).windows.tue).toEqual([{ open: '18:00', close: '22:00' }]);
  });
});

describe('computeSlots', () => {
  it('offers window starts in the restaurant’s zone, seats the party at the smallest free table', () => {
    const slots = computeSlots({ date: '2026-10-16', party: 2, settings, tables, bookings: [], now });
    expect(slots[0].time).toBe('12:00');
    expect(slots[0].table_id).toBe('t2');
    expect(slots.map((s) => s.time)).toContain('22:00');
    expect(slots.map((s) => s.time)).not.toContain('22:30'); // a seating must START inside the window
    expect(zonedInstant('2026-10-16', '19:00', 'Europe/Rome').toISOString()).toBe('2026-10-16T17:00:00.000Z');
  });
  it('a booked table is skipped for the whole seating; the next size up takes over', () => {
    const bookings = [{ table_id: 't2', starts_at: '2026-10-16T17:00:00.000Z', ends_at: '2026-10-16T18:30:00.000Z', status: 'booked' }];
    const slots = computeSlots({ date: '2026-10-16', party: 2, settings, tables, bookings, now });
    const at1900 = slots.find((s) => s.time === '19:00')!;
    expect(at1900.table_id).toBe('t4');
    const at1830 = slots.find((s) => s.time === '18:30');
    expect(at1830).toBeUndefined(); // 18:30 is before the evening window
    expect(slots.find((s) => s.time === '20:30')!.table_id).toBe('t2'); // free again after 20:30
  });
  it('a cancelled booking frees the table', () => {
    const bookings = [{ table_id: 't2', starts_at: '2026-10-16T17:00:00.000Z', ends_at: '2026-10-16T18:30:00.000Z', status: 'cancelled' }];
    expect(computeSlots({ date: '2026-10-16', party: 2, settings, tables, bookings, now }).find((s) => s.time === '19:00')!.table_id).toBe('t2');
  });
  it('respects lead time, party cap, closed dates and closed weekdays', () => {
    const late = new Date('2026-10-16T18:30:00Z'); // 20:30 Rome; lead 60 → earliest 21:30
    expect(computeSlots({ date: '2026-10-16', party: 2, settings, tables, bookings: [], now: late }).map((s) => s.time)).toEqual(['21:30', '22:00']);
    expect(computeSlots({ date: '2026-10-16', party: 9, settings, tables, bookings: [], now })).toEqual([]);
    expect(computeSlots({ date: '2026-10-16', party: 6, settings, tables, bookings: [], now })[0].table_id).toBe('t8');
    expect(computeSlots({ date: '2026-10-24', party: 2, settings, tables, bookings: [], now })).toEqual([]); // closed date (a Saturday)
    expect(computeSlots({ date: '2026-10-19', party: 2, settings, tables, bookings: [], now })).toEqual([]); // Monday: no window
    expect(weekdayOf('2026-10-16', 'Europe/Rome')).toBe('fri');
  });
  it('bookableDates lists only open days ahead', () => {
    const dates = bookableDates(settings, 10, now);
    expect(dates[0]).toBe('2026-10-16');
    expect(dates).toContain('2026-10-17');
    expect(dates).not.toContain('2026-10-19');
    expect(dates).not.toContain('2026-10-24');
  });
  it('a day whose last start is inside the lead time is not offered (a 24 h lead must not open on an empty "today")', () => {
    const appt = bookingSettingsFrom({ meta: { booking: { mode: 'appointment', tz: 'America/Los_Angeles', windows: { mon: [{ open: '09:00', close: '17:00' }], tue: [{ open: '09:00', close: '17:00' }] }, slot_minutes: 30, lead_minutes: 1440 } } });
    // Monday 2026-10-19, 08:00 Pacific: Monday's last start (16:30) is inside the 24 h lead; Tuesday's is not.
    const dates = bookableDates(appt, 10, new Date('2026-10-19T15:00:00Z'));
    expect(dates[0]).toBe('2026-10-20');
    expect(dates).not.toContain('2026-10-19');
    // The same Monday at 07:00 the day before is still on offer.
    expect(bookableDates(appt, 10, new Date('2026-10-18T14:00:00Z'))[0]).toBe('2026-10-19');
    // A one-hour lead at 08:00 keeps today (the restaurant fixture is unchanged above).
    expect(bookableDates({ ...appt, leadMinutes: 60 }, 10, new Date('2026-10-19T15:00:00Z'))[0]).toBe('2026-10-19');
  });
});

describe('strings', () => {
  it('Italian and English carry the same keys', () => {
    expect(BOOKING_STRING_KEYS_IT.sort()).toEqual(BOOKING_STRING_KEYS.sort());
  });
  it('speaks the locale, and the long date is in the restaurant’s zone and language', () => {
    expect(bookingStrings('it').title).toBe('Prenota un tavolo');
    expect(bookingStrings('en').title).toBe('Book a table');
    expect(bookingStrings('xx').title).toBe('Book a table');
    expect(longDate('2026-10-16', 'it', 'Europe/Rome')).toMatch(/venerdì 16 ottobre/);
    expect(longDate('2026-10-16', 'en', 'Europe/Rome')).toMatch(/Friday, October 16/);
  });
});

describe('appointment mode — one provider (Katie Bee Organizing, 2026-10-19)', () => {
  const appt = bookingSettingsFrom({ meta: { booking: { mode: 'appointment', preview: true, tz: 'America/Los_Angeles', windows: { mon: [{ open: '09:00', close: '17:00' }] }, max_party: 8, locale: 'en' } } });
  it('the party is pinned to one and preview is read; a restaurant site is unchanged', () => {
    expect(appt.mode).toBe('appointment');
    expect(appt.maxParty).toBe(1);
    expect(appt.preview).toBe(true);
    expect(settings.mode).toBe('table');
    expect(settings.preview).toBe(false);
    expect(bookingSettingsFrom({ meta: { booking: { mode: 'anything-else' } } }).mode).toBe('table');
  });
  it('the vocabulary is an OVERLAY: only keys the base has, both languages the same keys, and no table talk', () => {
    expect(APPOINTMENT_OVERLAY_KEYS.every((k) => BOOKING_STRING_KEYS.includes(k))).toBe(true);
    expect([...APPOINTMENT_OVERLAY_KEYS_IT].sort()).toEqual([...APPOINTMENT_OVERLAY_KEYS].sort());
    const t = bookingStrings('en', 'appointment');
    expect(t.title).toBe('Book a time');
    expect(t.lunch).toBe('Morning');
    expect(t.dinner).toBe('Afternoon');
    expect(t.confirmed({ time: '10:00', dateLong: 'Monday, October 20', party: 1, table: 'Katie' })).toBe('Monday, October 20 at 10:00. See you then.');
    expect(t.emailBody({ restaurant: 'Katie Bee Organizing', dateLong: 'Monday, October 20', time: '10:00', party: 1, table: 'Katie', phone: null })).not.toMatch(/table/i);
    const spoken = Object.values(t).filter((v): v is string => typeof v === 'string').join(' ');
    expect(spoken).not.toMatch(/\btables?\b/i);
    // the restaurant strings are untouched
    expect(bookingStrings('en').title).toBe('Book a table');
    expect(bookingStrings('it', 'appointment').title).toBe('Prenota un orario');
  });
  it('times group morning/afternoon at noon for a provider, lunch/dinner at 16:00 for a restaurant', () => {
    expect(serviceOf({ open: '11:30' }, 'appointment')).toBe('lunch');
    expect(serviceOf({ open: '13:00' }, 'appointment')).toBe('dinner');
    expect(serviceOf({ open: '13:00' })).toBe('lunch');
    expect(serviceOf({ open: '16:00' })).toBe('dinner');
  });
  it('the widget hides the guests picker, never posts on a preview site; the route refuses a preview booking before any row', () => {
    const w = read('components/admin/templates/render-blocks/table-booking.tsx');
    expect(w).toMatch(/const appointment = settings\.mode === 'appointment'/);
    expect(w).toMatch(/\{appointment \? null : \(\s*<label/);
    expect(w).toMatch(/bookingStrings\(settings\.locale, settings\.mode\)/);
    const previewAt = w.indexOf('if (settings.preview) {');
    expect(previewAt).toBeGreaterThan(0);
    expect(previewAt).toBeLessThan(w.indexOf('fetch(`/api/booking/${templateId}/book`'));
    expect(w).toMatch(/t\.previewBanner\(/);
    const r = read('app/api/booking/[templateId]/book/route.ts');
    const refuseAt = r.indexOf('site.settings.preview');
    expect(refuseAt).toBeGreaterThan(0);
    expect(refuseAt).toBeLessThan(r.indexOf('createBooking('));
    expect(r).toMatch(/mode: site\.settings\.mode/);
  });
});

describe('routes', () => {
  it('the guest route re-derives the slot from availability and emails only after the row exists', () => {
    const src = read('app/api/booking/[templateId]/book/route.ts');
    expect(src).toMatch(/const slots = await availability\(site, date, party\)/);
    expect(src.indexOf('createBooking(')).toBeGreaterThan(src.indexOf('availability(site'));
    expect(src.indexOf('notifyBooking(')).toBeGreaterThan(src.indexOf('createBooking('));
    expect(src).toMatch(/rateLimitOr429\(req, 'booking-book'/);
  });
  it('the day endpoint strips guest contact details for a partner and gates everyone else on the owner', () => {
    const src = read('app/api/booking/[templateId]/day/route.ts');
    expect(src).toMatch(/requireTemplateOwner\(templateId\)/);
    expect(src).toMatch(/checkBookingPartner\(req, `\$\{req\.nextUrl\.pathname\}\$\{req\.nextUrl\.search\}`\)/);
    const partnerShape = src.slice(src.indexOf('partner\n        ? {'), src.indexOf(': b,'));
    expect(partnerShape).not.toMatch(/guest_phone|guest_email|notes/);
    // The day's windows ride along (HJ asked, 2026-10-14) so the plan offers our slots, not a guess;
    // a closed date must answer [] rather than the weekday's windows.
    expect(src).toMatch(/const closed = site\.settings\.closedDates\.includes\(date\)/);
    expect(src).toMatch(/closed \? \[\] : site\.settings\.windows\[weekdayOf\(date, site\.settings\.tz\)\]/);
    expect(src).toMatch(/slot_minutes: site\.settings\.slotMinutes/);
  });
  it('the write routes are owner-gated, a partner signs the RAW body, and a bad signature never falls through to the session gate', () => {
    for (const p of ['app/api/booking/[templateId]/phone/route.ts', 'app/api/booking/[templateId]/cancel/route.ts']) {
      const src = read(p);
      expect(src).toMatch(/const raw = await req\.text\(\)/);
      expect(src).toMatch(/checkBookingPartner\(req, raw\)/);
      expect(src).toMatch(/if \(partnerCheck === 'bad_signature'\) return/);
      // The partner branch checks the owner's link (lib/booking/partnerLink.ts); everyone else hits the session gate.
      expect(src).toMatch(/if \(partnerCheck === 'ok'\) \{[^]*?isPartnerLinked\(templateId\)[^]*?\} else \{\s*const gate = await requireTemplateOwner\(templateId\)/);
      // Verify before parse: a body parsed first is a body that can differ from the one signed.
      expect(src.indexOf('checkBookingPartner(req, raw)')).toBeLessThan(src.indexOf('JSON.parse(raw'));
    }
  });
  it('the partner auth helper refuses a partner header with a bad signature rather than ignoring it', () => {
    const src = read('lib/booking/partnerAuth.ts');
    expect(src).toMatch(/'bad_signature'/);
    expect(src).toMatch(/x-partner-id/);
  });
  it('the widget renders nothing in public without bookable windows', () => {
    const src = read('components/admin/templates/render-blocks/table-booking.tsx');
    expect(src).toMatch(/if \(!isEditorContext\(previewOnly\)\) return null/);
    expect(src).toMatch(/hasBookableWindows\(settings\)/);
  });
});
