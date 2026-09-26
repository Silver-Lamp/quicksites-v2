-- 20260855_user_ui_prefs.sql
--
-- Per-user interface preferences. First tenant: whether the editor walkthrough has been seen.
--
-- ⚠️ WHY THIS EXISTS AT ALL, RATHER THAN localStorage. The editor's existing coach mark ("Hover
-- any section to edit or delete it… Got it") is localStorage-only, which means it cannot answer
-- either half of what a walkthrough needs:
--   • it reappears in a new browser, a new device, and EVERY private window — both first-run
--     screenshots we have are Incognito, so the hint showed every single time;
--   • and it can never be replayed from an account page, because nothing outside that one browser
--     knows it was dismissed.
-- "Once they log back in" is precisely the case localStorage cannot serve.
--
-- ⚠️ A SEPARATE TABLE, NOT A COLUMN ON `user_profiles`. That table carries `role`, and a
-- self-writable role was a real privilege escalation here once — `public.is_platform_admin()` no
-- longer trusts it for exactly that reason. Preferences are client-written by nature, so they go
-- somewhere with nothing worth escalating to.

create table if not exists public.user_ui_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- Open-ended on purpose: the next per-user toggle should not need a migration.
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_ui_prefs enable row level security;

-- Owner-scoped, and deliberately NO admin bypass: there is nothing here an operator needs to see,
-- and "support might want to check" is how a preferences table becomes a surveillance surface.
drop policy if exists user_ui_prefs_owner on public.user_ui_prefs;
create policy user_ui_prefs_owner on public.user_ui_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.user_ui_prefs is
  'Per-user UI preferences (walkthrough seen, etc). Owner-scoped RLS, no admin bypass.';
