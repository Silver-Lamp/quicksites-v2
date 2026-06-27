-- Checkout scaffold: relax legacy orders.amount_cents
-- System 2 (open_commerce) uses subtotal_cents/total_cents/platform_fee_cents.
-- The legacy System 1 column amount_cents was NOT NULL, which broke the new
-- order path. Make it nullable (createDraftOrder also mirrors total into it for
-- back-compat with any legacy order views).
alter table orders alter column amount_cents drop not null;
