// lib/rep/hours.ts
//
// The hourly arrangement a rep may have on top of their code (owner → Craig Baker, 2026-10-14:
// "$50/hr and ongoing commissions for any who sign up"; "I'll add a spot where you can enter
// your hours"). Pure rules here; the table is `rep_hours` (migration 20260885); the rep logs
// through /api/rep/hours with the page's signed grant; the owner marks rows paid from
// /admin/rep-hours. ⚠️ The RATE is per code and lives here, never typed into a page and never
// stored on the row — a page derives the figure from this map so it cannot drift from what is
// actually paid, and a row keeps its hours only, so changing a rate later does not rewrite what
// was agreed on the day.
export const REP_HOURLY_RATES: Record<string, number> = {
  craig: 5000, // cents per hour
};

export function hourlyRateCents(code: string): number | null {
  return REP_HOURLY_RATES[code.trim().toLowerCase()] ?? null;
}

/** Most a single entry may claim, and how many entries a day — a guard against a fat finger, not a budget. */
export const MAX_HOURS_PER_ENTRY = 12;
export const MAX_ENTRIES_PER_DAY = 3;

export type HoursInput = { workedOn: string; hours: number; note: string | null };

export function parseHoursInput(body: unknown, today = new Date()): { ok: true; value: HoursInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const workedOn = String(b.worked_on ?? b.date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workedOn) || Number.isNaN(new Date(`${workedOn}T12:00:00Z`).getTime())) return { ok: false, error: 'date_invalid' };
  // Not in the future (a day of tolerance for time zones), not older than 60 days.
  const t = new Date(`${workedOn}T12:00:00Z`).getTime();
  if (t > today.getTime() + 36 * 3600 * 1000) return { ok: false, error: 'date_future' };
  if (t < today.getTime() - 60 * 24 * 3600 * 1000) return { ok: false, error: 'date_too_old' };
  const hours = Number(b.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS_PER_ENTRY) return { ok: false, error: 'hours_invalid' };
  if (Math.round(hours * 4) !== hours * 4) return { ok: false, error: 'hours_quarter' }; // quarter hours
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
