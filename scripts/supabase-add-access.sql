alter table branding_profiles
add column if not exists access_token text;

alter table branding_profiles
add column if not exists password text;
