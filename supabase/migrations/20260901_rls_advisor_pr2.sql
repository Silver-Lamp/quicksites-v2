-- 20260901_rls_advisor_pr2.sql
--
-- Supabase security advisor, PR 2 of docs/SECURITY_ADVISOR_2026-10.md: the 18 tables that a
-- USER-SESSION client reaches on the server (deny-default would have broken a route). Each
-- gets the narrowest policy its callers need, decided from the call sites read on 2026-10-20
-- (file · client · operation · gate). `public.is_admin()` is SECURITY DEFINER over admin_users.
-- Idempotent: every policy is dropped and recreated.
--
-- Shape: `<table>_read` (SELECT, public or scoped) + `<table>_admin_all` (ALL, is_admin()) +
-- owner-scoped INSERT/UPDATE where a route writes as the caller. A table whose every caller is
-- the service role gets RLS with no policy at all.

create or replace function public._advisor_pr2_policy(p_table text, p_name text, p_sql text) returns void
language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  execute p_sql;
end $$;

-- ai_pricing_audit — every caller is the service-role client (the admin routes build their own).
alter table public.ai_pricing_audit enable row level security;

-- candidates / candidate_pages — public candidate pages (service role on the public page; the
-- admin pages write with the service role; save/plan routes write as an admin).
alter table public.candidates enable row level security;
select public._advisor_pr2_policy('candidates', 'candidates_read', $p$create policy candidates_read on public.candidates for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('candidates', 'candidates_admin_all', $p$create policy candidates_admin_all on public.candidates for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
alter table public.candidate_pages enable row level security;
select public._advisor_pr2_policy('candidate_pages', 'candidate_pages_read', $p$create policy candidate_pages_read on public.candidate_pages for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('candidate_pages', 'candidate_pages_admin_all', $p$create policy candidate_pages_admin_all on public.candidate_pages for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- client_errors — read by the admin traces page as the caller; written by the service role.
alter table public.client_errors enable row level security;
select public._advisor_pr2_policy('client_errors', 'client_errors_admin_read', $p$create policy client_errors_admin_read on public.client_errors for select to authenticated using (public.is_admin())$p$);

-- companies — RLS was OFF with two policies already written (public read of hours, creator
-- update). Keep both; add creator insert (api/company/create inserts as the caller) and admin.
alter table public.companies enable row level security;
select public._advisor_pr2_policy('companies', 'companies_insert_own', $p$create policy companies_insert_own on public.companies for insert to authenticated with check (created_by = auth.uid())$p$);
select public._advisor_pr2_policy('companies', 'companies_admin_all', $p$create policy companies_admin_all on public.companies for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- company_members — a member sees their own rows, a company's creator sees and manages its
-- members (api/company/create adds the creator as owner as the caller); admin everything.
alter table public.company_members enable row level security;
select public._advisor_pr2_policy('company_members', 'company_members_read', $p$create policy company_members_read on public.company_members for select to authenticated using (user_id = auth.uid() or public.is_admin() or exists (select 1 from public.companies c where c.id = company_members.company_id and c.created_by = auth.uid()))$p$);
select public._advisor_pr2_policy('company_members', 'company_members_insert', $p$create policy company_members_insert on public.company_members for insert to authenticated with check (public.is_admin() or exists (select 1 from public.companies c where c.id = company_members.company_id and c.created_by = auth.uid()))$p$);
select public._advisor_pr2_policy('company_members', 'company_members_delete', $p$create policy company_members_delete on public.company_members for delete to authenticated using (public.is_admin() or exists (select 1 from public.companies c where c.id = company_members.company_id and c.created_by = auth.uid()))$p$);

-- compliance_* — the admin compliance routes check admin_users then write AS THE CALLER;
-- the merchant-facing status route reads through the service role. Requirements are
-- jurisdiction reference data (no PII): public read.
alter table public.compliance_docs enable row level security;
select public._advisor_pr2_policy('compliance_docs', 'compliance_docs_admin_all', $p$create policy compliance_docs_admin_all on public.compliance_docs for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
alter table public.compliance_status enable row level security;
select public._advisor_pr2_policy('compliance_status', 'compliance_status_admin_all', $p$create policy compliance_status_admin_all on public.compliance_status for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
alter table public.compliance_requirements enable row level security;
select public._advisor_pr2_policy('compliance_requirements', 'compliance_requirements_read', $p$create policy compliance_requirements_read on public.compliance_requirements for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('compliance_requirements', 'compliance_requirements_admin_all', $p$create policy compliance_requirements_admin_all on public.compliance_requirements for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- coupons — a signed-in customer reads their own (my-active, as the caller); validate/lookup
-- and every write go through the service role.
alter table public.coupons enable row level security;
select public._advisor_pr2_policy('coupons', 'coupons_read_own', $p$create policy coupons_read_own on public.coupons for select to authenticated using (user_id = auth.uid() or public.is_admin())$p$);

-- deploy_errors — a log any signed-in site creator may append to (api/sites/create); admin reads.
alter table public.deploy_errors enable row level security;
select public._advisor_pr2_policy('deploy_errors', 'deploy_errors_insert', $p$create policy deploy_errors_insert on public.deploy_errors for insert to authenticated with check (true)$p$);
select public._advisor_pr2_policy('deploy_errors', 'deploy_errors_admin_read', $p$create policy deploy_errors_admin_read on public.deploy_errors for select to authenticated using (public.is_admin())$p$);

-- industries / industry_themes / mehko_opt_in_counties — reference data: public read, admin write.
alter table public.industries enable row level security;
select public._advisor_pr2_policy('industries', 'industries_read', $p$create policy industries_read on public.industries for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('industries', 'industries_admin_all', $p$create policy industries_admin_all on public.industries for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
alter table public.industry_themes enable row level security;
select public._advisor_pr2_policy('industry_themes', 'industry_themes_read', $p$create policy industry_themes_read on public.industry_themes for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('industry_themes', 'industry_themes_admin_all', $p$create policy industry_themes_admin_all on public.industry_themes for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
alter table public.mehko_opt_in_counties enable row level security;
select public._advisor_pr2_policy('mehko_opt_in_counties', 'mehko_opt_in_counties_read', $p$create policy mehko_opt_in_counties_read on public.mehko_opt_in_counties for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('mehko_opt_in_counties', 'mehko_opt_in_counties_admin_all', $p$create policy mehko_opt_in_counties_admin_all on public.mehko_opt_in_counties for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

-- public_profiles — carries `email`. Every reader and the upsert use the service role; the
-- policy is the owner's own row so a caller-session read could only ever see itself. No anon.
alter table public.public_profiles enable row level security;
select public._advisor_pr2_policy('public_profiles', 'public_profiles_own', $p$create policy public_profiles_own on public.public_profiles for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())$p$);

-- support_campaigns — the poster page reads a campaign by slug with the anon client; the
-- creator updates their own. `preclaim_token` is the one secret: it is removed from the
-- anon/authenticated column grant, so the two readers select explicit columns (same PR).
alter table public.support_campaigns enable row level security;
select public._advisor_pr2_policy('support_campaigns', 'support_campaigns_read', $p$create policy support_campaigns_read on public.support_campaigns for select to anon, authenticated using (deleted_at is null)$p$);
select public._advisor_pr2_policy('support_campaigns', 'support_campaigns_owner_update', $p$create policy support_campaigns_owner_update on public.support_campaigns for update to authenticated using (created_by = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or public.is_admin())$p$);
select public._advisor_pr2_policy('support_campaigns', 'support_campaigns_admin_all', $p$create policy support_campaigns_admin_all on public.support_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);
revoke select on public.support_campaigns from anon, authenticated;
grant select (id, slug, headline, goal_count, target_action, block_id, created_by, created_at, deleted_at) on public.support_campaigns to anon, authenticated;

-- template_base_meta — display names for a base slug: public read; written as the caller by
-- the owner of a template on that base (api/templates/base-name) or an admin.
alter table public.template_base_meta enable row level security;
select public._advisor_pr2_policy('template_base_meta', 'template_base_meta_read', $p$create policy template_base_meta_read on public.template_base_meta for select to anon, authenticated using (true)$p$);
select public._advisor_pr2_policy('template_base_meta', 'template_base_meta_owner_insert', $p$create policy template_base_meta_owner_insert on public.template_base_meta for insert to authenticated with check (public.is_admin() or exists (select 1 from public.templates t where t.base_slug = template_base_meta.base_slug and t.owner_id = auth.uid()))$p$);
select public._advisor_pr2_policy('template_base_meta', 'template_base_meta_owner_update', $p$create policy template_base_meta_owner_update on public.template_base_meta for update to authenticated using (public.is_admin() or exists (select 1 from public.templates t where t.base_slug = template_base_meta.base_slug and t.owner_id = auth.uid())) with check (public.is_admin() or exists (select 1 from public.templates t where t.base_slug = template_base_meta.base_slug and t.owner_id = auth.uid()))$p$);

-- template_versions — full site data per save. The editor's save bar INSERTS and the history
-- panel READS with the browser client as the owner; the public render and the publish paths use
-- the service role. Owner of the template (or admin) only. The two legacy anon-key history
-- routes (app/api/templates/history*, no callers) now answer empty, which is correct.
alter table public.template_versions enable row level security;
select public._advisor_pr2_policy('template_versions', 'template_versions_owner_read', $p$create policy template_versions_owner_read on public.template_versions for select to authenticated using (public.is_admin() or exists (select 1 from public.templates t where t.id = template_versions.template_id and t.owner_id = auth.uid()))$p$);
select public._advisor_pr2_policy('template_versions', 'template_versions_owner_insert', $p$create policy template_versions_owner_insert on public.template_versions for insert to authenticated with check (public.is_admin() or exists (select 1 from public.templates t where t.id = template_versions.template_id and t.owner_id = auth.uid()))$p$);
select public._advisor_pr2_policy('template_versions', 'template_versions_admin_write', $p$create policy template_versions_admin_write on public.template_versions for all to authenticated using (public.is_admin()) with check (public.is_admin())$p$);

drop function public._advisor_pr2_policy(text, text, text);
