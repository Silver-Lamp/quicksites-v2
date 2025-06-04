alter table leads add column if not exists owner_id uuid references auth.users(id);
alter table campaigns add column if not exists owner_id uuid references auth.users(id);
alter table domains add column if not exists owner_id uuid references auth.users(id);
