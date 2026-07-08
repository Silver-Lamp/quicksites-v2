-- Add the buyer FK the customer identity spine writes to.
--
-- CRM Phase 0 (20260707_customers_identity_spine) linked each paid order to a customer
-- via orders.customer_id and denormalized orders.customer_email. The email column was
-- added there, but customer_id was assumed to already exist on public.orders — it did
-- not. So markOrderPaid's best-effort link update silently failed on the missing column
-- (setting neither field), and /merchant/customers profiles had no order history to join.
--
-- This adds the column (nullable; FK → customers, set null on delete so removing a
-- customer never blocks or deletes their orders) + an index for the profile join.
-- Backfill of historical orders is a separate one-off: `npm run backfill:customers`.

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders(customer_id);
