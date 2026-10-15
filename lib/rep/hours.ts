// lib/rep/hours.ts
//
// Hourly pay as a per-rep OPTION on top of their code (owner, 2026-10-14). The arrangement lives on
// the code row — `hourly_enabled`, `hourly_rate_cents`, `hourly_paid_by` (migration 20260886) —
// and is edited from /admin/rep-hours; a rep logs through /api/rep/hours with their page's signed
// grant; the payer marks rows paid. ⚠️ The RATE lives on the code, never typed into a page and
// never stored on a logged row: a page derives the figure from the row so it cannot drift from
// what is paid, and `rep_hours` keeps hours only, so changing a rate later does not rewrite what
// was agreed on the day.
import { supabaseAdmin } from '@/lib/supabase/admin';

export const HOURLY_PAID_BY = ['operator', 'partner'] as const;
export type HourlyPaidBy = (typeof HOURLY_PAID_BY)[number];
export const PAID_BY_LABEL: Record<HourlyPaidBy, string> = { operator: 'QuickSites (Sandon)', partner: 'The partner who owns the rep' };

export type HourlyArrangement = { code: string; enabled: boolean; rateCents: number | null; paidBy: HourlyPaidBy | null };

/** Max per entry and per day — a guard against a fat finger, not a budget. */
export const MAX_HOURS_PER_ENTRY = 12;
export const MAX_ENTRIES_PER_DAY = 3;
export const MAX_RATE_CENTS = 100000;

/** Validate an admin's config edit. Enabling needs a rate and a payer; disabling clears neither (history). */
export function parseHourlyConfig(body: unknown): { ok: true; value: { code: string; enabled: boolean; rateCents: number | null; paidBy: HourlyPaidBy | null } } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = String(b.code ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(code)) return { ok: false, error: 'code_invalid' };
  const enabled = b.hourly_enabled === true || b.enabled === true;
  const rawRate = b.hourly_rate_cents ?? b.rateCents;
  const rateCents = rawRate == null || rawRate === '' ? null : Number(rawRate);
  if (rateCents != null && (!Number.isInteger(rateCents) || rateCents <= 0 || rateCents > MAX_RATE_CENTS)) return { ok: false, error: 'rate_invalid' };
  const rawPaidBy = b.hourly_paid_by ?? b.paidBy;
  const paidBy = rawPaidBy == null || rawPaidBy === '' ? null : (String(rawPaidBy) as HourlyPaidBy);
  if (paidBy != null && !HOURLY_PAID_BY.includes(paidBy)) return { ok: false, error: 'paid_by_invalid' };
  if (enabled && (rateCents == null || paidBy == null)) return { ok: false, error: 'enabled_needs_rate_and_payer' };
  return { ok: true, value: { code, enabled, rateCents, paidBy } };
}

type Row = { code: string; hourly_enabled: boolean | null; hourly_rate_cents: number | null; hourly_paid_by: string | null };

function fromRow(r: Row): HourlyArrangement {
  const paidBy = HOURLY_PAID_BY.includes(r.hourly_paid_by as HourlyPaidBy) ? (r.hourly_paid_by as HourlyPaidBy) : null;
  return { code: r.code, enabled: !!r.hourly_enabled, rateCents: r.hourly_rate_cents ?? null, paidBy };
}

/** One rep's arrangement; `enabled` is false for a code that does not exist. */
export async function loadHourly(code: string): Promise<HourlyArrangement> {
  const c = code.trim().toLowerCase();
  const { data } = await supabaseAdmin.from('referral_codes').select('code, hourly_enabled, hourly_rate_cents, hourly_paid_by').eq('code', c).maybeSingle();
  return data ? fromRow(data as Row) : { code: c, enabled: false, rateCents: null, paidBy: null };
}

export type RepConfigRow = HourlyArrangement & { label: string | null; ownerType: string | null; ownerEmail: string | null; parentCode: string | null; status: string | null };

/** Every rep code with its hourly config, for the admin table. */
export async function listRepHourlyConfigs(): Promise<RepConfigRow[]> {
  const { data } = await supabaseAdmin
    .from('referral_codes')
    .select('code, label, owner_type, owner_email, parent_code, status, hourly_enabled, hourly_rate_cents, hourly_paid_by')
    .order('created_at');
  return ((data ?? []) as Array<Row & { label: string | null; owner_type: string | null; owner_email: string | null; parent_code: string | null; status: string | null }>).map((r) => ({
    ...fromRow(r),
    label: r.label,
    ownerType: r.owner_type,
    ownerEmail: r.owner_email,
    parentCode: r.parent_code,
    status: r.status,
  }));
}

export type HoursInput = { workedOn: string; hours: number; note: string | null };

export function parseHoursInput(body: unknown, today = new Date()): { ok: true; value: HoursInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const workedOn = String(b.worked_on ?? b.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workedOn) || Number.isNaN(new Date(`${workedOn}T12:00:00Z`).getTime())) return { ok: false, error: 'date_invalid' };
  const t = new Date(`${workedOn}T12:00:00Z`).getTime();
  if (t > today.getTime() + 36 * 3600 * 1000) return { ok: false, error: 'date_future' };
  if (t < today.getTime() - 60 * 24 * 3600 * 1000) return { ok: false, error: 'date_too_old' };
  const hours = Number(b.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS_PER_ENTRY) return { ok: false, error: 'hours_invalid' };
  if (Math.round(hours * 4) !== hours * 4) return { ok: false, error: 'hours_quarter' };
  const note = String(b.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 240) || null;
  return { ok: true, value: { workedOn, hours, note } };
}

export type HoursRow = { id: string; worked_on: string; hours: number; note: string | null; created_at: string; paid_at: string | null; paid_via: string | null };
export type HoursSummary = { hoursTotal: number; hoursPaid: number; hoursOwed: number; owedCents: number; paidCents: number };

export function summarizeHours(rows: HoursRow[], rateCents: number): HoursSummary {
  let hoursTotal = 0;
  let hoursPaid = 0;
  for (const r of rows) {
    const h = Number(r.hours) || 0;
    hoursTotal += h;
    if (r.paid_at) hoursPaid += h;
  }
  const hoursOwed = Math.round((hoursTotal - hoursPaid) * 100) / 100;
  return { hoursTotal, hoursPaid, hoursOwed, owedCents: Math.round(hoursOwed * rateCents), paidCents: Math.round(hoursPaid * rateCents) };
}

export const moneyFromCents = (c: number) => `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
