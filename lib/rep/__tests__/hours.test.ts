/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseHoursInput, parseHourlyConfig, summarizeHours, MAX_HOURS_PER_ENTRY, HOURLY_PAID_BY } from '@/lib/rep/hours';
import { REP_TERRITORIES } from '@/lib/rep/territories';
import { stripComments } from '@/test/stripComments';

const read = (p: string) => stripComments(fs.readFileSync(path.join(process.cwd(), p), 'utf8'));
const today = new Date('2026-10-14T20:00:00Z');

describe('parseHoursInput', () => {
  it('accepts a day, quarter hours and a note', () => {
    expect(parseHoursInput({ worked_on: '2026-10-12', hours: 2.5, note: '  Town,  Burton ' }, today)).toEqual({ ok: true, value: { workedOn: '2026-10-12', hours: 2.5, note: 'Town, Burton' } });
    expect(parseHoursInput({ date: '2026-10-14', hours: '1' }, today)).toEqual({ ok: true, value: { workedOn: '2026-10-14', hours: 1, note: null } });
  });
  it('refuses the future, the distant past, non-quarter hours, zero and more than a day', () => {
    expect(parseHoursInput({ worked_on: '2026-10-20', hours: 1 }, today)).toEqual({ ok: false, error: 'date_future' });
    expect(parseHoursInput({ worked_on: '2026-07-01', hours: 1 }, today)).toEqual({ ok: false, error: 'date_too_old' });
    expect(parseHoursInput({ worked_on: '2026-10-12', hours: 1.1 }, today)).toEqual({ ok: false, error: 'hours_quarter' });
    expect(parseHoursInput({ worked_on: '2026-10-12', hours: 0 }, today)).toEqual({ ok: false, error: 'hours_invalid' });
    expect(parseHoursInput({ worked_on: '2026-10-12', hours: MAX_HOURS_PER_ENTRY + 1 }, today)).toEqual({ ok: false, error: 'hours_invalid' });
    expect(parseHoursInput({ worked_on: 'yesterday', hours: 1 }, today)).toEqual({ ok: false, error: 'date_invalid' });
  });
});

describe('parseHourlyConfig — hourly pay as a per-rep option', () => {
  it('turning it on needs a rate and who pays', () => {
    expect(parseHourlyConfig({ code: 'craig', hourly_enabled: true, hourly_rate_cents: 5000, hourly_paid_by: 'operator' })).toEqual({ ok: true, value: { code: 'craig', enabled: true, rateCents: 5000, paidBy: 'operator' } });
    expect(parseHourlyConfig({ code: 'craig', hourly_enabled: true, hourly_rate_cents: 5000 })).toEqual({ ok: false, error: 'enabled_needs_rate_and_payer' });
    expect(parseHourlyConfig({ code: 'craig', hourly_enabled: true, hourly_paid_by: 'operator' })).toEqual({ ok: false, error: 'enabled_needs_rate_and_payer' });
  });
  it('off keeps a remembered rate and payer (history), and refuses bad values', () => {
    expect(parseHourlyConfig({ code: 'abdou', hourly_enabled: false, hourly_rate_cents: 4000, hourly_paid_by: 'partner' })).toEqual({ ok: true, value: { code: 'abdou', enabled: false, rateCents: 4000, paidBy: 'partner' } });
    expect(parseHourlyConfig({ code: 'abdou', hourly_enabled: false })).toEqual({ ok: true, value: { code: 'abdou', enabled: false, rateCents: null, paidBy: null } });
    expect(parseHourlyConfig({ code: 'abdou', hourly_rate_cents: -5 })).toEqual({ ok: false, error: 'rate_invalid' });
    expect(parseHourlyConfig({ code: 'abdou', hourly_rate_cents: 12.5 })).toEqual({ ok: false, error: 'rate_invalid' });
    expect(parseHourlyConfig({ code: 'abdou', hourly_paid_by: 'uncle' })).toEqual({ ok: false, error: 'paid_by_invalid' });
    expect(parseHourlyConfig({ code: 'no spaces', hourly_enabled: false })).toEqual({ ok: false, error: 'code_invalid' });
    expect([...HOURLY_PAID_BY]).toEqual(['operator', 'partner']);
  });
});

describe('summarizeHours', () => {
  it('splits paid from open and prices at the rate', () => {
    const rows = [
      { id: 'a', worked_on: '2026-10-11', hours: 2, note: null, created_at: '', paid_at: '2026-10-13', paid_via: 'venmo' },
      { id: 'b', worked_on: '2026-10-12', hours: 3.5, note: null, created_at: '', paid_at: null, paid_via: null },
    ];
    expect(summarizeHours(rows, 5000)).toEqual({ hoursTotal: 5.5, hoursPaid: 2, hoursOwed: 3.5, owedCents: 17500, paidCents: 10000 });
  });
  it('craig has a territory', () => {
    expect(REP_TERRITORIES.craig).toEqual({ city: 'Vashon', region: 'WA', label: 'Vashon Island' });
  });
});

describe('the migration', () => {
  it('defaults every rep to commission-only and switches craig on with a rate and a payer', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260886_referral_codes_hourly.sql'), 'utf8');
    expect(sql).toMatch(/hourly_enabled boolean not null default false/);
    expect(sql).toMatch(/hourly_paid_by in \('operator','partner'\)/);
    expect(sql).toMatch(/set hourly_enabled = true, hourly_rate_cents = 5000, hourly_paid_by = 'operator'\s+where code = 'craig'/);
  });
});

describe('the for-craig page', () => {
  const page = read('app/for-craig/page.tsx');
  it('is unlisted and derives every dollar figure from the code row', () => {
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(page).toMatch(/loadHourly\(CODE\)/);
    expect(page).not.toMatch(/\$50|\$ 50/); // the rate comes from the row, never typed
    expect(page).toMatch(/\{codePct\}%/);
    expect(page).not.toMatch(/\b35%/);
  });
  it('shows the hours log only when the option is on, and names the two payment paths honestly', () => {
    expect(page).toMatch(/\{hourlyOn && \(\s*<section[^]*?<HoursLog token=\{repToken\} repName=\{NAME\} \/>/);
    expect(page).toMatch(/Stripe or Venmo/);
    expect(page).toMatch(/never paid anyone/);
    expect(page).not.toMatch(/guarantee|rank on Google|page one|licensed/i);
  });
  it('tells him exactly what to say and links the kit and the dashboard', () => {
    expect(page).toMatch(/handing these out for someone who makes e-commerce websites and used to live on the island/);
    expect(page).toMatch(/\/starter-kit\/\$\{CODE\}/);
    expect(page).toMatch(/signInHref\('\/referrals\/dashboard'\)/);
  });
});

describe('the hours routes', () => {
  it('the rep route is gated on the signed grant and the code row\'s hourly option; the admin route on requireAdmin', () => {
    const rep = read('app/api/rep/hours/route.ts');
    expect(rep).toMatch(/verifyRepActionToken\(token\)/);
    expect(rep).toMatch(/loadHourly\(grant\.code\)/);
    expect(rep).toMatch(/!arr\.enabled/);
    expect(rep).toMatch(/MAX_ENTRIES_PER_DAY/);
    expect(rep).toMatch(/rateLimitOr429\(req, 'rep-hours-write'/);
    const adm = read('app/api/admin/rep-hours/route.ts');
    expect((adm.match(/requireAdmin\(\)/g) ?? []).length).toBe(3); // GET, PATCH, POST
    expect(adm).toMatch(/parseHourlyConfig\(body\)/);
    expect(adm).toMatch(/\.is\('paid_at', null\)/); // marking paid never re-stamps an already-paid row
  });
});
