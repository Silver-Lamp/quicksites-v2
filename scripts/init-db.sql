create extension if not exists "uuid-ossp";

create table if not exists domains (
  id uuid primary key default uuid_generate_v4(),
  domain text unique not null,
  city text not null,
  state text not null,
  industry text default 'towing',
  template_id text default 'template1',
  is_claimed boolean default false,
  claimed_by uuid references auth.users(id),
  date_created timestamptz default now(),
  notes text
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  business_name text,
  contact_name text,
  phone text,
  email text,
  domain_id uuid references domains(id),
  outreach_status text default 'not_contacted',
  date_created timestamptz default now()
);

alter table domains enable row level security;
alter table leads enable row level security;

create policy "Allow service role full access"
  on domains for all
  using (true) with check (true);

create policy "Allow service role full access"
  on leads for all
  using (true) with check (true);
