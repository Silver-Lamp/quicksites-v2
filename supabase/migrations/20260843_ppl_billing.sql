-- 20260843_ppl_billing.sql
--
-- Pay-per-call (PPL) billing for geo-domain campaigns (docs/PPL_VERTICAL.md).
--
-- The rental rail sells the DOMAIN for a flat monthly rent. This sells the CALLS: a business
-- prepays a balance, every qualified call on the campaign's tracking number debits one lead
-- price, and the balance auto-reloads from the card on file when it runs low. Same asset, same
-- tracking number, same Twilio path — a different price shape for a shop that will not sign a
-- subscription but will pay for a ringing phone.
--
-- ⚠️ THE LEDGER IS THE TRUTH; the account's balance_cents is a cache of its sum. Two facts the
-- DATABASE enforces, because the draft this was adapted from left both to application code and
-- got both wrong: (1) a call is charged at most once — `call_sid` is unique among lead charges;
-- (2) a Stripe PaymentIntent is credited at most once — `stripe_payment_intent_id` is unique.
-- The draft's reload used a 10-second idempotency bucket on the charge and NO key on the credit,
-- so two calls in one window charged the card once and credited the balance twice.
--
-- Money in integer cents, signed: deposits and credits are positive, charges negative.
-- Deny-default RLS: written by the signed Twilio + Stripe webhooks and admin routes (service
-- role). An owner-facing statement, when built, reads through a narrow server route.

create table if not exists public.ppl_accounts (
  id                        uuid primary key default gen_random_uuid(),
  geo_campaign_id           uuid not null references public.geo_industry_campaigns(id) on delete cascade,
  business_name             text not null,
  contact_email             text,
  contact_phone             text,                       -- where qualified calls are bridged (E.164)
  stripe_customer_id        text,
  stripe_payment_method_id  text,                       -- saved at the first deposit; reloads charge it off-session
  cpl_cents                 int  not null default 8500  check (cpl_cents > 0),
  min_billable_seconds      int  not null default 90    check (min_billable_seconds >= 0),
  reload_threshold_cents    int  not null default 30000 check (reload_threshold_cents >= 0),
  reload_amount_cents       int  not null default 120000 check (reload_amount_cents > 0),
  auto_reload               boolean not null default true,
  balance_cents             int  not null default 0,    -- cache of sum(ppl_ledger.amount_cents)
  status                    text not null default 'pending'
                              check (status in ('pending','active','paused','closed')),
  paused_reason             text,
  paused_at                 timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists ppl_accounts_campaign_uniq on public.ppl_accounts (geo_campaign_id);
create index if not exists ppl_accounts_stripe_customer_idx on public.ppl_accounts (stripe_customer_id);

create table if not exists public.ppl_ledger (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid not null references public.ppl_accounts(id) on delete cascade,
  kind                      text not null
                              check (kind in ('deposit','lead_charge','dispute_credit','adjustment')),
  amount_cents              int  not null,
  balance_after_cents       int  not null,
  call_sid                  text,                       -- set on lead_charge (and the credit that reverses it)
  caller_number             text,                       -- E.164; the business needs it to dispute
  duration_seconds          int,
  stripe_payment_intent_id  text,                       -- set on a deposit funded by a PaymentIntent / Checkout
  memo                      text,
  created_by                uuid,                       -- admin who posted a manual credit/adjustment
  created_at                timestamptz not null default now()
);

-- One charge per call. A retry of the Twilio callback (they retry on non-2xx) must not double-bill.
create unique index if not exists ppl_ledger_lead_charge_call_uniq
  on public.ppl_ledger (call_sid) where kind = 'lead_charge';
-- One credit per PaymentIntent. Two concurrent reloads resolving to the same PI credit once.
create unique index if not exists ppl_ledger_payment_intent_uniq
  on public.ppl_ledger (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists ppl_ledger_account_created_idx on public.ppl_ledger (account_id, created_at desc);

create table if not exists public.ppl_disputes (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid not null references public.ppl_accounts(id) on delete cascade,
  ledger_id                 uuid not null references public.ppl_ledger(id) on delete cascade,
  call_sid                  text not null,
  category                  text not null
                              check (category in ('GEO','SVC','DUP','EXC','SPM','DUR','OTHER')),
  explanation               text not null,
  status                    text not null default 'open'
                              check (status in ('open','approved','denied')),
  decided_by                uuid,
  decided_at                timestamptz,
  decision_note             text,
  created_at                timestamptz not null default now()
);

create unique index if not exists ppl_disputes_ledger_uniq on public.ppl_disputes (ledger_id);
create index if not exists ppl_disputes_open_idx on public.ppl_disputes (status) where status = 'open';

-- Post a ledger row and move the cached balance in ONE statement, under the account's row lock,
-- so two concurrent charges cannot both read the same starting balance. Returns the row, or
-- NULL when the unique indexes above say this charge/credit was already posted (the caller
-- treats NULL as "already done", never as an error).
create or replace function public.ppl_post_ledger(
  p_account_id uuid,
  p_kind text,
  p_amount_cents int,
  p_call_sid text default null,
  p_caller_number text default null,
  p_duration_seconds int default null,
  p_stripe_payment_intent_id text default null,
  p_memo text default null,
  p_created_by uuid default null
) returns public.ppl_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_row public.ppl_ledger;
begin
  select balance_cents into v_balance from public.ppl_accounts where id = p_account_id for update;
  if v_balance is null then
    raise exception 'ppl account % not found', p_account_id;
  end if;

  begin
    insert into public.ppl_ledger
      (account_id, kind, amount_cents, balance_after_cents, call_sid, caller_number,
       duration_seconds, stripe_payment_intent_id, memo, created_by)
    values
      (p_account_id, p_kind, p_amount_cents, v_balance + p_amount_cents, p_call_sid, p_caller_number,
       p_duration_seconds, p_stripe_payment_intent_id, p_memo, p_created_by)
    returning * into v_row;
  exception when unique_violation then
    return null;
  end;

  update public.ppl_accounts
     set balance_cents = v_balance + p_amount_cents, updated_at = now()
   where id = p_account_id;

  return v_row;
end;
$$;

revoke all on function public.ppl_post_ledger(uuid, text, int, text, text, int, text, text, uuid) from public;
grant execute on function public.ppl_post_ledger(uuid, text, int, text, text, int, text, text, uuid) to service_role;

alter table public.ppl_accounts enable row level security;
alter table public.ppl_ledger   enable row level security;
alter table public.ppl_disputes enable row level security;
-- Deny-default: no policies. Service role bypasses RLS; nothing else reads these.

comment on table public.ppl_accounts is 'Pay-per-call prepaid accounts, one per geo campaign. balance_cents caches sum(ppl_ledger). See docs/PPL_VERTICAL.md.';
comment on table public.ppl_ledger   is 'Signed integer-cent ledger for PPL accounts. Unique partial indexes make one charge per call and one credit per PaymentIntent a DB guarantee.';
comment on table public.ppl_disputes is 'A business contesting one lead charge. Approval posts a dispute_credit ledger row against the same call_sid.';
