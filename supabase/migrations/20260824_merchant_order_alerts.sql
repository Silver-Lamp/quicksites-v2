-- 20260824_merchant_order_alerts.sql
--
-- Tell the restaurant an order came in.
--
-- ⚠️ THE GAP THIS CLOSES. markOrderPaid did tax, stock, CRM upsert, commission and POD
-- fulfilment — and never notified the merchant. A restaurant's only way to learn about an order
-- was to open /merchant/orders and look. A kitchen on a Friday dinner rush does not refresh a
-- dashboard; every delivery platform ships a device that makes a noise, and that is why.
--
-- `order_notify_email` is an OPTIONAL override. Default recipient stays the merchant's own
-- account email (merchants.user_id -> auth.users.email), resolved server-side, so alerting works
-- with no setup at all. The override exists because the person who signs up is often not the
-- person standing at the counter.
alter table if exists public.merchants
  add column if not exists order_notify_email text;

comment on column public.merchants.order_notify_email is
  'Optional override for new-order alerts. Null => the merchant account email. Never client-supplied at send time; resolved server-side from the order.';

-- Idempotency ledger: one alert per order, ever.
--
-- ⚠️ Stripe retries webhooks, and markOrderPaid is deliberately re-runnable. Without this a
-- retried webhook re-alerts a kitchen for an order they already cooked — and the second buzz is
-- worse than none, because it teaches them to distrust the first.
create table if not exists public.order_alerts (
  order_id     uuid primary key references public.orders(id) on delete cascade,
  channel      text not null default 'email',
  recipient    text,
  sent_at      timestamptz not null default now(),
  error        text
);

comment on table public.order_alerts is
  'One row per order alerted. Primary key IS order_id: the uniqueness constraint is the idempotency guarantee, not application logic.';

-- Deny-default: alert rows carry a merchant recipient address. Service-role only, like the rest
-- of the money path (CLAUDE.md §6 — route-level authz is load-bearing, RLS is the backstop).
alter table public.order_alerts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_alerts' and policyname = 'order_alerts_deny_all'
  ) then
    create policy order_alerts_deny_all on public.order_alerts for all using (false) with check (false);
  end if;
end $$;
