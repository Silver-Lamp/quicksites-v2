alter table branding_profiles
add column if not exists is_shared boolean default false;
