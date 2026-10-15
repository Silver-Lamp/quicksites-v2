// lib/rep/hoursDb.ts — the SERVER half of the hourly option: reads of `referral_codes.hourly_*`.
//
// ⚠️ Kept apart from lib/rep/hours.ts on purpose. That module is imported by CLIENT components
// (components/for-rep/hours-log.tsx, app/admin/rep-hours/page.tsx) for the pure helpers, and on
// 2026-10-14 (#1209) `loadHourly` lived there with its `supabaseAdmin` import — so the browser
// bundle pulled in the service-role client, it threw at module init, and /for-craig and
// /admin/rep-hours collapsed to Next's client-error page after hydrating from a perfectly good
// server render. Server HTML looked right; the page was blank. A test now pins that hours.ts
// imports nothing from @/lib/supabase.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { HOURLY_PAID_BY, type HourlyArrangement, type HourlyPaidBy, type RepConfigRow } from '@/lib/rep/hours';

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
