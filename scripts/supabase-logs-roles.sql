-- Simulated roles table for user override
create or replace view user_roles as
select
  u.id as user_id,
  case
    when u.email ilike '%@quicksites.ai' then 'admin'
    else 'user'
  end as role
from auth.users u;

-- Add branding logs
create table if not exists branding_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references branding_profiles(id) on delete cascade,
  user_id uuid,
  event text,
  details text,
  created_at timestamptz default now()
);

-- Public insert policy for logging access
alter table branding_logs enable row level security;

create policy "Anyone can log events"
on branding_logs
for insert
with check (true);
