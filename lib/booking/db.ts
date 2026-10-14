// lib/booking/db.ts
//
// The service-role reads and writes behind /api/booking. Every function takes a templateId and
// scopes on it; the routes decide who may call them (public + rate-limited for availability and
// a guest booking; site owner or admin for the day list, phone bookings and cancellations).
import { supabaseAdmin } from '@/lib/supabase/admin';
import { bookingSettingsFrom, type BookingSettings } from '@/lib/booking/settings';
import { computeSlots, zonedInstant, type BookingRange, type Slot, type TableRow } from '@/lib/booking/slots';
import { addMinutes } from 'date-fns';

export type BookingSite = { id: string; slug: string | null; name: string; settings: BookingSettings; ownerId: string | null };

export async function loadBookingSite(templateId: string): Promise<BookingSite | null> {
  const { data } = await supabaseAdmin.from('templates').select('id, slug, business_name, template_name, data, owner_id').eq('id', templateId).maybeSingle();
  if (!data) return null;
  const d = data as any;
  return { id: d.id, slug: d.slug ?? null, name: String(d.business_name || d.template_name || 'the restaurant'), settings: bookingSettingsFrom(d.data), ownerId: d.owner_id ?? null };
}

export async function loadTables(templateId: string): Promise<TableRow[]> {
  const { data } = await supabaseAdmin.from('restaurant_tables').select('id, label, seats, active').eq('template_id', templateId).eq('active', true).order('sort').order('seats');
  return ((data ?? []) as TableRow[]).map((t) => ({ id: t.id, label: t.label, seats: Number(t.seats), active: t.active }));
}

/** Bookings that could overlap a calendar day in the restaurant's zone (a day plus a margin either side). */
export async function loadBookingsAround(templateId: string, date: string, tz: string): Promise<BookingRange[]> {
  const from = addMinutes(zonedInstant(date, '00:00', tz), -6 * 60).toISOString();
  const to = addMinutes(zonedInstant(date, '23:59', tz), 6 * 60).toISOString();
  const { data } = await supabaseAdmin.from('table_bookings').select('table_id, starts_at, ends_at, status').eq('template_id', templateId).gte('starts_at', from).lte('starts_at', to);
  return (data ?? []) as BookingRange[];
}

export async function availability(site: BookingSite, date: string, party: number, now = new Date()): Promise<Slot[]> {
  const [tables, bookings] = await Promise.all([loadTables(site.id), loadBookingsAround(site.id, date, site.settings.tz)]);
  return computeSlots({ date, party, settings: site.settings, tables, bookings, now });
}

export type NewBooking = {
  templateId: string;
  tableId: string;
  party: number;
  startsAt: string;
  endsAt: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  notes: string | null;
  source: 'web' | 'phone';
  locale: 'it' | 'en';
};

export type BookingRow = {
  id: string;
  table_id: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
};

/** Inserts; the exclusion constraint answers the race with `taken`. */
export async function createBooking(b: NewBooking): Promise<{ ok: true; booking: BookingRow } | { ok: false; error: 'taken' | 'invalid' | 'failed'; detail?: string }> {
  const { data, error } = await supabaseAdmin
    .from('table_bookings')
    .insert({
      template_id: b.templateId,
      table_id: b.tableId,
      party_size: b.party,
      starts_at: b.startsAt,
      ends_at: b.endsAt,
      guest_name: b.guestName,
      guest_phone: b.guestPhone,
      guest_email: b.guestEmail,
      notes: b.notes,
      source: b.source,
      locale: b.locale,
      status: 'booked',
    })
    .select('id, table_id, party_size, starts_at, ends_at, guest_name, guest_phone, guest_email, status, source, notes, created_at')
    .single();
  if (error) {
    // 23P01 = exclusion_violation: the table was taken between the availability read and this insert.
    if (`${error.code}` === '23P01') return { ok: false, error: 'taken' };
    if (`${error.code}` === '23503' || `${error.code}` === '23514') return { ok: false, error: 'invalid', detail: error.message };
    return { ok: false, error: 'failed', detail: error.message };
  }
  return { ok: true, booking: data as BookingRow };
}

export async function listBookingsForDay(templateId: string, date: string, tz: string): Promise<BookingRow[]> {
  const from = zonedInstant(date, '00:00', tz).toISOString();
  const to = addMinutes(zonedInstant(date, '23:59', tz), 1).toISOString();
  const { data } = await supabaseAdmin
    .from('table_bookings')
    .select('id, table_id, party_size, starts_at, ends_at, guest_name, guest_phone, guest_email, status, source, notes, created_at')
    .eq('template_id', templateId)
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at');
  return (data ?? []) as BookingRow[];
}

export async function cancelBooking(templateId: string, bookingId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('table_bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('template_id', templateId)
    .eq('id', bookingId)
    .neq('status', 'cancelled')
    .select('id');
  return !error && !!data?.length;
}

export async function setBookingStatus(templateId: string, bookingId: string, status: 'booked' | 'seated' | 'no_show'): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('table_bookings').update({ status }).eq('template_id', templateId).eq('id', bookingId).neq('status', 'cancelled').select('id');
  return !error && !!data?.length;
}
