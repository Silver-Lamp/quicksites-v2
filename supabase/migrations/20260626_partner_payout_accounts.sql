-- Where a partner receives payouts (their Stripe Connect account), so we can
-- transfer their residual commissions out. Mirrors payment_accounts but keyed to
-- the partner user (referral_codes.owner_id), not a merchant.
create table if not exists partner_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  account_ref text,                      -- Stripe connected account id
  status text not null default 'pending',-- 'pending' | 'active'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
alter table partner_payout_accounts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='partner_payout_accounts' and policyname='ppa_owner_read') then
    create policy ppa_owner_read on partner_payout_accounts for select using (user_id = auth.uid());
  end if;
end $$;
