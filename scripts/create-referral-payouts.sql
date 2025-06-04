create table if not exists referral_payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  amount numeric,
  note text,
  paid_at timestamptz default now()
);
