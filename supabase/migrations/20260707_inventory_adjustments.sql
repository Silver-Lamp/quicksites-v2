-- Inventory adjustments ledger (INVENTORY_PLAN.md Phase 2).
--
-- An append-only audit trail of every stock change: sales, refund restocks, and
-- manual merchant edits (set / receive / correct). Stock itself still lives in
-- catalog_items.metadata; this table is the HISTORY of how it got there, so a
-- merchant can answer "why is this 3?" and reconcile discrepancies.

create table if not exists public.inventory_adjustments (
  id             uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  variant_id     text,                      -- null = item-level (plain product)
  delta          int not null,              -- signed change (-2 sale, +5 restock)
  new_on_hand    int,                       -- resulting quantity, when known (null = untracked)
  reason         text not null,             -- sale | refund | restock | manual | receive | correction | initial
  order_id       uuid,                      -- the order that caused it, for sale/refund
  actor_id       uuid,                      -- the user who made a manual change
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists inventory_adjustments_item_idx
  on public.inventory_adjustments(catalog_item_id, created_at desc);

alter table public.inventory_adjustments enable row level security;

-- Deny-default: service-role writes (the app records these). Owners may READ their
-- own item history (join item → merchant → owner). No browser writes.
drop policy if exists inv_adj_owner_read on public.inventory_adjustments;
create policy inv_adj_owner_read on public.inventory_adjustments
  for select using (
    exists (
      select 1
      from public.catalog_items ci
      join public.merchants m on m.id = ci.merchant_id
      where ci.id = inventory_adjustments.catalog_item_id
        and m.owner_id = auth.uid()
    )
  );
