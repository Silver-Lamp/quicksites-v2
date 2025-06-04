-- Branding Profiles Table
create table if not exists branding_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme text check (theme in ('light', 'dark')) default 'dark',
  brand text check (brand in ('green', 'blue', 'red')) default 'green',
  accent_color text,
  logo_url text,
  created_at timestamptz default now()
);

-- Add reference to snapshots
alter table snapshots
add column if not exists branding_profile_id uuid references branding_profiles(id) on delete set null;

-- Insert baseline profiles
insert into branding_profiles (name, theme, brand, accent_color)
values
  ('Towing Pro Dark', 'dark', 'blue', '#3b82f6'),
  ('Construction Bold', 'light', 'red', '#ef4444'),
  ('Generic Green Default', 'light', 'green', '#22c55e')
on conflict do nothing;
