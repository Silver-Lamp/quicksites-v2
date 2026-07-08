-- CRM Phase 2: free-text notes on a customer (mirrors the leads.notes pattern).
--
-- tags jsonb + marketing_consent already exist on customers from the Phase 0 spine;
-- this adds the last field needed to make a customer profile an annotatable record.
-- Writes stay service-role-only (deny-default RLS unchanged) — the merchant-owner
-- edit path goes through an owner-gated API route, not RLS.

alter table public.customers add column if not exists notes text;
