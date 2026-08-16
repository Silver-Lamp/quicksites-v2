-- 20260828_template_bases_use_base_slug.sql
--
-- The admin list showed "Renton Lemonade" carrying renton-plumbing's slug, domain and industry.
--
-- `template_bases` (a MATERIALIZED view) recomputes its own family key instead of using the
-- trigger-maintained `templates.base_slug` that it already selects one line above:
--
--     CASE WHEN slug ~ '-[A-Za-z0-9]{2,12}$'
--          THEN regexp_replace(slug, '-[A-Za-z0-9]{2,12}$', '')
--          ELSE slug END AS base_key
--
-- That is exactly the greedy pattern migration 20260809 removed from the generated column,
-- because it cannot tell a random suffix from a real word. It strips the INDUSTRY off every
-- geo site:
--
--     renton-lemonade  ->  renton
--     renton-plumbing  ->  renton
--
-- Both land in one family, and `DISTINCT ON (base_key)` keeps exactly one. The loser does not
-- merely display oddly — it VANISHES from the grouped list, absorbed into a family it has
-- nothing to do with. Two businesses in different industries are never variants of each other.
--
-- ⚠️ THE API ALREADY TRIED TO FIX THIS AND COULD NOT REACH. app/api/admin/templates/list
-- qualifies its root key by industry and documents this precise failure in a long comment — but
-- it runs on rows the view has ALREADY merged, so there is one row to qualify and the fix has
-- nothing to separate. A display-layer patch over a data-layer merge looks like a fix, reads
-- like a fix, passes review, and changes nothing.
--
-- 20260809 converted the columns in place specifically so the dependent views survived
-- untouched. They survived — and this one kept its own private copy of the discarded rule.
-- That is the deferred cost of convert-in-place, now paid.
--
-- Measured on the live DB before applying: 989 families -> 1056. 67 were wrongly merged.
--
-- A materialized view cannot be CREATE OR REPLACE'd, so this drops and recreates it, then
-- restores all four indexes, the dependent `template_bases_secure` view, and its grants. The
-- column list is unchanged, so nothing downstream needs to know. Wrapped in a transaction: it
-- either all lands or none of it does, and the matview is derived entirely from `templates`,
-- so no source data is at risk.

-- NOTE: no BEGIN/COMMIT here. scripts/db-migrate.mjs runs each migration inside its own
-- transaction, so an explicit one warns "there is already a transaction in progress" and the
-- COMMIT would end the runner's transaction early — atomicity comes from the runner.
DROP MATERIALIZED VIEW IF EXISTS public.template_bases CASCADE;

CREATE MATERIALIZED VIEW public.template_bases AS
 WITH t_with_base AS (
         SELECT t.id,
            t.template_name,
            t.industry,
            t.layout,
            t.color_scheme,
            t.data,
            t.created_at,
            t.updated_at,
            t.domain,
            t.published,
            t.custom_domain,
            t.logo_url_meta,
            t.hero_url_meta,
            t.gallery_meta,
            t.logo_url,
            t.hero_url,
            t.banner_url,
            t.banner_url_meta,
            t.slug,
            t.name,
            t.theme,
            t.archived,
            t.brand,
            t.editor_id,
            t.is_site,
            t.meta,
            t.verified,
            t.services,
            t.site_id,
            t.team_url,
            t.commit,
            t.default_subdomain,
            t.last_editor,
            t.save_count,
            t.saved_at,
            t.search_engines_last_pinged_at,
            t.search_engines_last_ping_response,
            t.claimed_by,
            t.claimed_at,
            t.claim_source,
            t.phone,
            t.color_mode,
            t.header_block,
            t.footer_block,
            t.base_slug,
            t.is_version,
            t.domain_lc,
            t.contact_email,
            t.business_name,
            t.address_line1,
            t.address_line2,
            t.city,
            t.state,
            t.postal_code,
            t.latitude,
            t.longitude,
            t.owner_id,
            t.services_jsonb,
            t.published_version_id,
            t.published_at,
            t.published_by,
            t.hours,
            t.merchant_id,
            t.industry_gen,
            t.phone_gen,
            t.rev,
            -- ⚠️ USE THE MAINTAINED COLUMN. `templates.base_slug` is kept correct on every write
            -- by public.base_slug_of() + trg_templates_set_base_slug (migrations 20260809/10),
            -- which strips ONE trailing token of 4-5 chars — the shape the app's own random
            -- suffix produces — instead of any trailing word. Recomputing here was how the two
            -- rules drifted apart. Fall back to the slug only for rows that never persisted a
            -- base_slug, where the row is its own family.
            COALESCE(NULLIF(btrim(t.base_slug), ''::text), t.slug) AS base_key
           FROM templates t
        ), canon AS (
         SELECT DISTINCT ON (t_with_base.base_key) t_with_base.id AS canonical_id,
            t_with_base.base_key,
            t_with_base.slug AS canonical_slug,
            t_with_base.template_name AS canonical_template_name,
            t_with_base.updated_at AS canonical_updated_at,
            t_with_base.created_at AS canonical_created_at,
            t_with_base.owner_id,
            t_with_base.archived,
            t_with_base.color_mode,
            t_with_base.is_site,
            t_with_base.industry AS canonical_industry,
            t_with_base.city AS canonical_city
           FROM t_with_base
          ORDER BY t_with_base.base_key, (
                CASE
                    WHEN COALESCE(t_with_base.is_version, false) = false THEN 0
                    ELSE 1
                END), t_with_base.created_at
        ), latest AS (
         SELECT DISTINCT ON (t_with_base.base_key) t_with_base.id AS latest_id,
            t_with_base.base_key,
            t_with_base.updated_at AS latest_version_updated_at,
            t_with_base.industry AS latest_industry,
            t_with_base.industry_gen,
            t_with_base.city AS latest_city,
                CASE
                    WHEN pg_typeof(t_with_base.data)::oid = 'jsonb'::regtype::oid THEN safe_jsonb(t_with_base.data)
                    WHEN pg_typeof(t_with_base.data)::oid = 'json'::regtype::oid THEN safe_jsonb(t_with_base.data::json::jsonb)
                    ELSE safe_jsonb(t_with_base.data::text)
                END AS data_jsonb,
            t_with_base.banner_url
           FROM t_with_base
          ORDER BY t_with_base.base_key, t_with_base.updated_at DESC
        )
 SELECT c.base_key AS base_slug,
    c.canonical_id,
    c.canonical_slug,
    c.canonical_template_name,
    c.canonical_updated_at,
    c.canonical_created_at,
    c.owner_id,
    c.archived,
    COALESCE(c.canonical_industry, l.latest_industry, l.industry_gen, (l.data_jsonb -> 'meta'::text) ->> 'industry'::text) AS industry,
    COALESCE(c.canonical_city, l.latest_city, (l.data_jsonb -> 'meta'::text) ->> 'city'::text, ((l.data_jsonb -> 'meta'::text) -> 'location'::text) ->> 'city'::text) AS city,
    c.color_mode,
    c.is_site,
    l.latest_version_updated_at,
    GREATEST(c.canonical_updated_at, l.latest_version_updated_at) AS effective_updated_at,
    l.banner_url
   FROM canon c
     LEFT JOIN latest l USING (base_key);

-- Indexes exactly as they were. template_bases_pk and template_bases_v3_base_slug_idx are
-- duplicates of one another in the original schema; both are recreated rather than "tidied",
-- because a migration that quietly drops an index someone may depend on is a second change
-- wearing the clothes of the first.
CREATE UNIQUE INDEX template_bases_unique ON public.template_bases USING btree (canonical_id);
CREATE UNIQUE INDEX template_bases_pk ON public.template_bases USING btree (base_slug);
CREATE UNIQUE INDEX template_bases_v3_base_slug_idx ON public.template_bases USING btree (base_slug);
CREATE INDEX template_bases_v3_effective_updated_idx ON public.template_bases USING btree (effective_updated_at DESC);

CREATE VIEW public.template_bases_secure AS
 SELECT template_bases.base_slug,
    template_bases.canonical_id,
    template_bases.canonical_slug,
    template_bases.canonical_template_name,
    template_bases.canonical_updated_at,
    template_bases.canonical_created_at,
    template_bases.owner_id,
    template_bases.archived,
    template_bases.industry,
    template_bases.color_mode,
    template_bases.is_site,
    template_bases.latest_version_updated_at,
    template_bases.effective_updated_at
   FROM template_bases;

-- Grants as captured from the live database before the drop.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.template_bases_secure TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.template_bases_secure TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.template_bases_secure TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.template_bases_secure TO postgres;

