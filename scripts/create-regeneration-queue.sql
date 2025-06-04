create table if not exists regeneration_queue (
  id uuid primary key default uuid_generate_v4(),
  domain text not null,
  template_id text not null,
  city text not null,
  state text not null,
  status text default 'queued',
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz,
  log text
);
