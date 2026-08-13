-- 20260825_order_fulfillment.sql
--
-- Where an order is in the KITCHEN, separate from where it is in the MONEY.
--
-- ⚠️ A SECOND COLUMN, NOT A WIDENED `status`. `orders.status` means payment ('pending' → 'paid' →
-- refunded). Adding 'preparing'/'ready' to it would force one of two independent facts to be wrong
-- the moment a paid order sits unmade — and the fact that gets lost is always the operational one,
-- because the money path is the one with tests behind it.
--
-- Before this, /merchant/orders was a read-only list with a status badge and a Refund button. A
-- restaurant could see that an order existed and could not record that they had made it.
alter table if exists public.orders
  add column if not exists fulfillment_status text not null default 'new',
  add column if not exists accepted_at  timestamptz,
  add column if not exists ready_at     timestamptz,
  add column if not exists completed_at timestamptz;

comment on column public.orders.fulfillment_status is
  'Kitchen state: new | preparing | ready | completed | cancelled. Independent of `status`, which is payment.';
comment on column public.orders.ready_at is
  'Last transition into ready. Overwritten on re-entry: if an order goes ready -> preparing -> ready, the SECOND stamp is when the food was actually collectable. Ticket-time measured from a retracted milestone flatters us.';

-- ⚠️ Deliberately NOT a CHECK constraint on the value set.
-- A kitchen screen must accept corrections (ready -> preparing when the wrong bag went out).
-- Validity is enforced at the API boundary by `isFulfillmentStatus`, where a bad value returns 400
-- with a message, rather than in the database, where it surfaces as an opaque 500 mid-rush.
-- If a future migration adds a CHECK here, it needs to allow every state in FULFILLMENT_STATES and
-- stay in sync with lib/commerce/fulfillment.ts — two sources of truth for one list.

-- The merchant screen's only query: this shop's live tickets, oldest first.
create index if not exists orders_merchant_fulfillment_idx
  on public.orders (merchant_id, fulfillment_status, created_at desc);
