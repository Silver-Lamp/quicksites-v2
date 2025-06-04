create table if not exists lead_action_logs (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id),
  domain_id uuid references domains(id),
  action_type text not null,
  triggered_by text,
  timestamp timestamptz default now()
);
