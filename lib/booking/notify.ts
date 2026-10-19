// lib/booking/notify.ts
//
// Who is told about a booking: the guest (when they left an email) and the restaurant (the
// site's contact email). Plain text in the guest's language (lib/booking/i18n.ts). Best-effort:
// a failed email never fails the booking — the row is the booking, the email is a courtesy.
import { sendEmail } from '@/lib/email';
import { bookingStrings, longDate, type BookingLocale, type BookingStringsMode } from '@/lib/booking/i18n';
import { formatInTimeZone } from 'date-fns-tz';
import type { BookingRow } from '@/lib/booking/db';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function notifyBooking(input: {
  booking: BookingRow;
  tableLabel: string;
  restaurant: string;
  restaurantEmail: string | null;
  restaurantPhone: string | null;
  tz: string;
  locale: BookingLocale;
  /** `appointment` speaks of a time with a person, not a table (lib/booking/i18n.ts overlay). */
  mode?: BookingStringsMode;
}): Promise<{ guest: boolean; owner: boolean }> {
  const { booking: b } = input;
  const t = bookingStrings(input.locale, input.mode ?? 'table');
  const date = formatInTimeZone(new Date(b.starts_at), input.tz, 'yyyy-MM-dd');
  const time = formatInTimeZone(new Date(b.starts_at), input.tz, 'HH:mm');
  const dateLong = longDate(date, input.locale, input.tz);
  const body = t.emailBody({ restaurant: input.restaurant, dateLong, time, party: b.party_size, table: input.tableLabel, phone: input.restaurantPhone });
  let guest = false;
  let owner = false;
  if (b.guest_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.guest_email)) {
    try {
      await sendEmail({ to: b.guest_email, subject: t.emailSubject({ restaurant: input.restaurant }), html: `<p>${esc(body)}</p>` });
      guest = true;
    } catch {
      /* courtesy only */
    }
  }
  if (input.restaurantEmail) {
    try {
      const line = `${dateLong} ${time} · ${t.guests(b.party_size)} · ${t.table} ${input.tableLabel} · ${b.guest_name}${b.guest_phone ? ` · ${b.guest_phone}` : ''}${b.source === 'phone' ? ` (${t.byPhone})` : ''}${b.notes ? ` · ${b.notes}` : ''}`;
      await sendEmail({ to: input.restaurantEmail, subject: t.ownerEmailSubject({ restaurant: input.restaurant }), html: `<p>${esc(line)}</p>` });
      owner = true;
    } catch {
      /* courtesy only */
    }
  }
  return { guest, owner };
}
