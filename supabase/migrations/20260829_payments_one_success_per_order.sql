-- 20260829_payments_one_success_per_order.sql
--
-- One successful payment row per order.
--
-- WHY THIS SHAPE AND NOT THE OBVIOUS ONE. The first live card payment ($4, order 181e76f0) wrote
-- TWO succeeded rows, so the payments ledger read $8 for a $4 charge. Stripe reports success twice
-- — once as `checkout.session.completed` and once as `payment_intent.succeeded` — and the handler
-- recorded each, because the two events carry DIFFERENT ids:
--
--     pi_3U5DgvC4HdCgjN3o3REaCQ9F    (payment intent)
--     cs_live_b1A59z3f2YHvnEwVpfuUkt8h…  (checkout session)
--
-- ⚠️ So the intuitive guard — UNIQUE (provider, provider_payment_id, state) — would NOT have
-- prevented this, and was proposed before anyone looked at the rows. The ids differ, so both
-- inserts are legal under it. The duplicate is per-ORDER, so the constraint has to be per-order.
-- Verified against the live table before writing this: exactly one order was affected, out of
-- 6 payment rows across 4 orders.
--
-- Partial, on `state='succeeded'`, for two reasons: a refund legitimately adds a second row for the
-- same order (state='refunded' — there is one such row in the table today, on a different order),
-- and a failed attempt followed by a successful retry is a normal history we do not want to forbid.
--
-- The duplicate row was recorded in full and deleted before this migration, because Postgres will
-- not create a unique index that existing data violates. Owner decision, 2026-08-17.

create unique index if not exists payments_one_succeeded_per_order
  on public.payments (order_id)
  where state = 'succeeded';

comment on index public.payments_one_succeeded_per_order is
  'One succeeded payment per order. Stripe reports success twice (session + intent) with different ids, so a provider_payment_id key does not catch it. Partial so refunds and retries stay legal.';
