-- Checkout scaffold: order_items.metadata (open_commerce has it; live table lacked it)
alter table order_items add column if not exists metadata jsonb not null default '{}'::jsonb;
