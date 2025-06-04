alter table branding_profiles
add column if not exists owner_id uuid references auth.users(id);

alter table branding_profiles
add column if not exists is_public boolean default false;
