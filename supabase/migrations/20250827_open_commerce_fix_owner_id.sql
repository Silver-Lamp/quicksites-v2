-- Normalize merchants.owner_id, regardless of prior schema

do $$
begin
  -- Case A: legacy column is user_id (no owner_id yet) → rename
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'merchants' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'merchants' and column_name = 'owner_id'
  ) then
    execute 'alter table public.merchants rename column user_id to owner_id';
  end if;

  -- Case B: both exist (someone added owner_id later) → backfill then drop user_id
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'merchants' and column_name = 'user_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'merchants' and column_name = 'owner_id'
  ) then
    execute 'update public.merchants set owner_id = coalesce(owner_id, user_id)';
    -- drop the legacy column to avoid future ambiguity
    execute 'alter table public.merchants drop column user_id';
  end if;
end $$;

-- Recreate/ensure the composite uniqueness on (owner_id, site_slug)
do $$
begin
  if exists (select 1 from pg_indexes where schemaname='public' and indexname='merchants_user_site_idx') then
    execute 'drop index if exists public.merchants_user_site_idx';
  end if;
  -- safe create for the new name
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='merchants_owner_site_idx') then
    execute 'create unique index merchants_owner_site_idx on public.merchants(owner_id, site_slug)';
  end if;
end $$;

-- Helper uses owner_id (now guaranteed to exist)
create or replace function public.is_owner(uid uuid, m_id uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.merchants where id = m_id and owner_id = uid);
$$;
