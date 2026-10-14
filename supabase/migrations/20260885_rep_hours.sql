-- Rep hours (lib/rep/hours.ts). A rep on an hourly arrangement (Craig on Vashon, 2026-10-14:
-- flyers at island businesses, paid per hour plus lifetime commissions) logs the day, the hours
-- and where they went from their unlisted /for-<name> page; the owner reviews and marks rows paid
-- (Stripe or Venmo, outside this system). The log is the record both sides read; the rate lives
-- in code (REP_HOURLY_RATES), not in the row, so a rate change never rewrites history silently.
create table if not exists public.rep_hours (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.referral_codes(code) on delete cascade,
  worked_on date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 12),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_via text check (paid_via is null or paid_via in ('stripe','venmo','other')),
  paid_note text
);
create index if not exists rep_hours_code_worked_on_idx on public.rep_hours (code, worked_on desc);

-- Deny-default: service role only. The rep writes through a signed route, the owner through an
-- admin route; nothing reads this table from a browser session.
alter table public.rep_hours enable row level security;
