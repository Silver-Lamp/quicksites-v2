create table if not exists public.referral_logs (
  id uuid primary key default gen_random_uuid(),
  email text,
  ref text,
  source text,
  campaign text,
  joined_at timestamp with time zone default now()
);
