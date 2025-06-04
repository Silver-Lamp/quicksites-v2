create table if not exists published_sites (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references snapshots(id) on delete cascade,
  branding_profile_id uuid references branding_profiles(id),
  slug text unique not null,
  status text default 'draft',
  published_at timestamptz,
  owner_id uuid references auth.users(id),
  created_at timestamptz default now()
);
