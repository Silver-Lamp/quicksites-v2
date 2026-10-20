-- 20260900_rls_advisor_pr1.sql
--
-- Supabase's weekly security advisor (issues as of 2026-10-17; email 2026-10-20) flagged this
-- project for rls_disabled_in_public, sensitive_columns_exposed and auth_users_exposed. This is
-- PR 1 of the plan in docs/SECURITY_ADVISOR_2026-10.md — the part that changes nothing a
-- legitimate caller does. Proven before/after with scripts/rls-probe.mts. Idempotent.
--
-- 1) Views that hand out what the tables' RLS protects.
--    branding_profiles_with_email joins auth.users and exposed access_token, password and the
--    owner's auth email to the anon key (10 rows); no code reads it. templates_versions served
--    3,391 draft rows past the templates RLS (anon sees 191 published); no code reads it.
--    mobile_session_summary re-opened session_logs (locked 2026-07); no code reads it.
drop view if exists public.branding_profiles_with_email;
drop view if exists public.templates_versions;
drop view if exists public.mobile_session_summary;

-- 2) The views that stay are read under the CALLER's RLS, not the owner's. templates_effective /
--    templates_latest (the preview page) then show the rows the caller may see; the rest sit on
--    tables with public-read policies and keep working. Three aggregate views stay owner-run on
--    purpose — click_summary (an admin page reads it from the browser), checkin_map_points (a
--    public map endpoint), block_feedback_summary — they return counts, never a row.
do $$
declare v text;
begin
  foreach v in array array['templates_effective','templates_latest','template_bases_secure','organizations_public','org_domains_public','features_public_portfolio'] loop
    if exists (select 1 from pg_views where schemaname = 'public' and viewname = v) then
      execute format('alter view public.%I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;

-- A view never takes a write; every public view carried INSERT/UPDATE/DELETE/TRUNCATE grants.
do $$
declare v text;
begin
  for v in select viewname from pg_views where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', v);
  end loop;
end $$;

-- 3) Policies that are TO public USING (true) on tables where RLS is ON — live, not inert.
--    draft_sites: anyone could read and write every draft (the owner policy stays; the service
--    role bypasses RLS and needs no policy). agent_block_presets: anyone could insert or delete;
--    the only writer is app/api/agents/presets (requireAdmin, caller session). admin_users: the
--    list of admins was public; a caller needs only their own row (the templates policy's
--    EXISTS subquery) and is_admin() is SECURITY DEFINER.
drop policy if exists "Allow service role full access" on public.draft_sites;

drop policy if exists presets_write on public.agent_block_presets;
drop policy if exists presets_delete on public.agent_block_presets;
create policy presets_write on public.agent_block_presets for insert to authenticated with check (public.is_admin());
create policy presets_delete on public.agent_block_presets for delete to authenticated using (public.is_admin());

drop policy if exists admin_users_read on public.admin_users;
create policy admin_users_read on public.admin_users for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- 4) Deny-default RLS (no policies: only the service role reads) on the tables that only
--    service-role code, scripts, or nothing touches. Browser-read and session-read tables are
--    PR 2 and PR 3 of the plan and are deliberately NOT here. call_logs is the one that matters
--    most: callers' numbers and voicemail transcripts, created in September with no RLS line.
do $$
declare t text;
begin
  foreach t in array array[
    -- service-role only
    'ai_estimates','ai_pricing_sources','block_feedback','blocks','call_logs','click_events',
    'compliance_notifications','deploy_logs','geo_cache','leaderboard_cache','not_found_logs',
    'param_presets','published_site_views','regeneration_queue','screenshot_queue',
    'short_link_clicks','snapshot_views','starter_templates','support_requests','support_tickets',
    'template_admin_meta','template_events','template_views','thank_you_notes','tracking_checkins',
    -- referenced nowhere in code
    'block_checkins','claimed_handles','early_access_codes','guest_conversions','ip_geo_cache',
    'meal_post_markers','nav_events','nav_preferences','qr_scan_events','regeneration_logs',
    'review_helpful_votes','review_token_events','scheduled_posts','shared_previews',
    'shared_templates','site_edits','site_referrals','site_themes','sitemap_logs','social_webhooks',
    'steward_rewards','template_logs','testimonial_presets','theme_presets','user_settings'
  ] loop
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = t and c.relkind = 'r') then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
