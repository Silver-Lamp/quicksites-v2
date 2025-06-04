-- Create reusable branding profiles
create table if not exists branding_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text check (theme in ('light', 'dark')) default 'dark',
  brand text check (brand in ('green', 'blue', 'red')) default 'green',
  accent_color text,
  logo_url text,
  created_at timestamptz default now()
);

-- Link branding profiles to snapshots
alter table snapshots
add column if not exists branding_profile_id uuid references branding_profiles(id) on delete set null;
