-- Enable RLS
alter table branding_profiles enable row level security;

-- Allow owners to read/update/delete their own branding profiles
create policy "Profile owner can modify own data"
on branding_profiles
for all
using (auth.uid() = owner_id);

-- Optional: public profiles can be read by anyone
create policy "Public profiles are readable"
on branding_profiles
for select
using (is_public = true);
