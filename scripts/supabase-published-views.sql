alter table published_sites
add column if not exists is_public boolean default true;

create table if not exists published_site_views (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references published_sites(id) on delete cascade,
  referrer text,
  user_agent text,
  viewed_at timestamptz default now()
);
