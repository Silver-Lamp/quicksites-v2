-- 20260902_rls_advisor_pr3.sql
--
-- Supabase security advisor, PR 3 of docs/SECURITY_ADVISOR_2026-10.md: the 12 tables BROWSER
-- code reads with the anon-key client, plus one policy the probe exposed on `templates`.
-- Decided from the call sites read on 2026-10-20. Nearly every reader is a legacy admin page or
-- component, so the policy is `is_admin()`; the three with an owner get owner scope. Writes
-- that routes perform with the service role need no policy. Idempotent.
--
-- ⚠️ `admin/lib/supabaseClient.ts` was a bare `createClient` with no cookie session — every
-- component importing it ran as `anon`. The same PR makes it the cookie-aware browser client,
-- so an admin's own session reaches these policies. Without that change every one of these
-- pages would read empty.

create or replace function public._advisor_pr3_policy(p_table text, p_name text, p_sql text) returns void
language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  execute p_sql;
end $$;

-- Admin-only tables (legacy admin pages read and write them from the browser).
do $$
declare t text;
begin
  foreach t in array array['campaign_leads','dashboard_layout_templates','dashboard_layout_versions','grid_presets','template_images'] loop
    execute format('alter table public.%I enable row level security', t);
    perform public._advisor_pr3_policy(t, t || '_admin_all', format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t));
  end loop;
end $$;

-- dashboard_user_layouts — admin assigns layouts to users; a user may read their own row.
alter table public.dashboard_user_layouts enable row level security;
select public._advisor_pr3_policy('dashboard_user_layouts', 'dashboard_user_layouts_admin_all', $p$create policy dashboard_user_layouts_admin_all on public.dashboard_user_layouts for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
select public._advisor_pr3_policy('dashboard_user_layouts', 'dashboard_user_layouts_own_read', $p$create policy dashboard_user_layouts_own_read on public.dashboard_user_layouts for select to authenticated using (user_id = auth.uid())$p$);

-- guest_upgrade_events — the funnel route inserts (service role; a guest's own row is also
-- allowed as the caller), admin pages read.
alter table public.guest_upgrade_events enable row level security;
select public._advisor_pr3_policy('guest_upgrade_events', 'guest_upgrade_events_admin_read', $p$create policy guest_upgrade_events_admin_read on public.guest_upgrade_events for select to authenticated using (public.is_admin())$p$);
select public._advisor_pr3_policy('guest_upgrade_events', 'guest_upgrade_events_own_insert', $p$create policy guest_upgrade_events_own_insert on public.guest_upgrade_events for insert to authenticated with check (guest_user_id = auth.uid()::text)$p$);

-- site_events — any signed-in admin-area user appends (admin/utils/logEvent.ts); admin reads.
alter table public.site_events enable row level security;
select public._advisor_pr3_policy('site_events', 'site_events_insert', $p$create policy site_events_insert on public.site_events for insert to authenticated with check (true)$p$);
select public._advisor_pr3_policy('site_events', 'site_events_admin_read', $p$create policy site_events_admin_read on public.site_events for select to authenticated using (public.is_admin())$p$);

-- token_logs — admin log page reads; written by the service role.
alter table public.token_logs enable row level security;
select public._advisor_pr3_policy('token_logs', 'token_logs_admin_read', $p$create policy token_logs_admin_read on public.token_logs for select to authenticated using (public.is_admin())$p$);

-- user_site_settings — a user's own glow settings (components/glow-configurator.tsx).
alter table public.user_site_settings enable row level security;
select public._advisor_pr3_policy('user_site_settings', 'user_site_settings_own', $p$create policy user_site_settings_own on public.user_site_settings for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())$p$);

-- published_sites — the editor's domain panel reads the owner's row from the browser; every
-- write is a service-role route (publish, unpublish, custom-domain, the OG image route after
-- this PR). The public render reads via the service role, so no anon read.
alter table public.published_sites enable row level security;
select public._advisor_pr3_policy('published_sites', 'published_sites_owner_read', $p$create policy published_sites_owner_read on public.published_sites for select to authenticated using (public.is_admin() or exists (select 1 from public.templates t where t.id = published_sites.template_id and t.owner_id = auth.uid()))$p$);
select public._advisor_pr3_policy('published_sites', 'published_sites_admin_all', $p$create policy published_sites_admin_all on public.published_sites for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- snapshots — editor-side reads (new-site chooser, shared preview) and inserts (the share
-- button, the owner-gated snapshots route) as the OWNER of the template; custom-domain serving
-- (app/host) is service role. A row carries owner_id and/or template_id; either proves it.
alter table public.snapshots enable row level security;
select public._advisor_pr3_policy('snapshots', 'snapshots_owner_read', $p$create policy snapshots_owner_read on public.snapshots for select to authenticated using (public.is_admin() or owner_id = auth.uid() or exists (select 1 from public.templates t where t.id = snapshots.template_id and t.owner_id = auth.uid()))$p$);
select public._advisor_pr3_policy('snapshots', 'snapshots_owner_insert', $p$create policy snapshots_owner_insert on public.snapshots for insert to authenticated with check (public.is_admin() or owner_id = auth.uid() or exists (select 1 from public.templates t where t.id = snapshots.template_id and t.owner_id = auth.uid()))$p$);
select public._advisor_pr3_policy('snapshots', 'snapshots_admin_all', $p$create policy snapshots_admin_all on public.snapshots for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- templates — the public-read policy was `TO anon` only, so a SIGNED-IN visitor (a guest holds
-- `authenticated`) reading a published site through the browser client saw nothing while anon
-- saw 191 rows (seen by the PR 1 after-probe). Published is published for everyone.
alter policy public_read_published_sites on public.templates to anon, authenticated;

drop function public._advisor_pr3_policy(text, text, text);
