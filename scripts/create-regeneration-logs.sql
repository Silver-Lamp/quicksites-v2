create table if not exists regeneration_logs (
  id uuid primary key default uuid_generate_v4(),
  domain text not null,
  template_id text not null,
  city text,
  state text,
  status text,
  timestamp timestamptz default now()
);
