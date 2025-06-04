alter table regeneration_queue
add column if not exists retry_enabled boolean default false;
