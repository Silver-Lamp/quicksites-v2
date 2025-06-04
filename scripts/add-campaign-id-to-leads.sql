alter table leads add column if not exists campaign_id uuid references campaigns(id);
