alter table regeneration_queue
add column if not exists triggered_by text;
