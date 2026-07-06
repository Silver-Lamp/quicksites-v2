-- Buyer special instructions on an order ("no cilantro", "leave at door").
--
-- Captured at checkout (app/checkout/page.tsx → /api/commerce/checkout →
-- createDraftOrder) and surfaced to the merchant on their orders view. Optional;
-- createDraftOrder fail-opens if this column is absent, so it's safe to apply late.
alter table public.orders add column if not exists customer_note text;
