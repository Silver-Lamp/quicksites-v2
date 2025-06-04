create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  city text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text default 'upcoming',
  lead_ids uuid[],
  domain_ids uuid[],
  created_at timestamptz default now()
);
