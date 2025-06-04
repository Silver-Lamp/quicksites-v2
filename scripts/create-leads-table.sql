create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  business_name text not null,
  email text,
  phone text,
  outreach_status text default 'not_contacted',
  notes text,
  domain_id uuid references domains(id),
  created_at timestamptz default now()
);
