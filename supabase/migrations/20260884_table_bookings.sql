-- Table booking for restaurant sites (lib/booking/*; the Italy demo, 2026-10-14).
--
-- A site-scoped pair: a table is a row with seats, a booking occupies one table for a range.
-- The database holds the one invariant that matters — two bookings cannot share a table for a
-- minute — with the same GiST exclusion the legacy app.bookings proved out, and a cancellation
-- frees the table by construction (the predicate excludes cancelled rows). Service-role only:
-- every read and write goes through the owner-gated / rate-limited routes under /api/booking.
create extension if not exists btree_gist;

create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  label text not null,
  seats integer not null check (seats between 1 and 40),
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists restaurant_tables_template_idx on public.restaurant_tables(template_id, active, sort);

create table if not exists public.table_bookings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  party_size integer not null check (party_size between 1 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_name text not null,
  guest_phone text,
  guest_email text,
  status text not null default 'booked' check (status in ('booked', 'seated', 'no_show', 'cancelled')),
  source text not null default 'web' check (source in ('web', 'phone')),
  notes text,
  locale text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint table_bookings_valid_range check (ends_at > starts_at),
  -- ⚠️ The invariant. Cancelled rows are excluded, so cancelling reopens the slot without a delete.
  constraint table_bookings_no_overlap exclude using gist (table_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status <> 'cancelled')
);
create index if not exists table_bookings_template_day_idx on public.table_bookings(template_id, starts_at);

alter table public.restaurant_tables enable row level security;
alter table public.table_bookings enable row level security;
-- Deny-default: no policies. The service role bypasses RLS; nothing else may touch these.
