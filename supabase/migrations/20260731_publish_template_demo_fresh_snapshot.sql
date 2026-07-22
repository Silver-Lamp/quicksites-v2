-- Fix: publish_template_demo must mint a FRESH snapshot on every publish.
--
-- The original (20260629) only inserted a new template_versions row when NO snapshot
-- existed yet (`if v_snap is null`); on a RE-publish it reused the most-recent existing
-- snapshot. Because the public render reads immutable content by snapshot id
-- (published_sites.snapshot_id -> template_versions.full_data, see
-- app/sites/[slug]/[[...rest]]/page.tsx), re-publishing an already-published demo/persona/
-- restaurant site silently kept serving STALE content — the edited templates.data never
-- went live. The render's own contract is explicit: "a republish mints a brand-new
-- snapshot id and flips published_sites.snapshot_id". This makes the RPC honor that.
--
-- Behaviour change: first publish is identical; re-publish now snapshots current
-- templates.data (the intended immutable-version-history design) and repoints the
-- published_sites pointer at it. Idempotent (create or replace).

create or replace function public.publish_template_demo(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap uuid;
  v_tpl  record;
begin
  select id, slug, template_name, data,
         coalesce(nullif(custom_domain,''), nullif(domain,'')) as dom
    into v_tpl
    from public.templates
   where id = p_template_id;
  if not found then raise exception 'template % not found', p_template_id; end if;

  -- Always mint a fresh immutable snapshot of the CURRENT data (never reuse an old one).
  insert into public.template_versions (id, template_id, template_name, full_data, created_at, commit_message)
  values (gen_random_uuid(), p_template_id, v_tpl.template_name, v_tpl.data, now(), 'auto-publish (demo)')
  returning id into v_snap;

  insert into public.published_sites (id, template_id, snapshot_id, domain, published_at, status, is_public)
  values (gen_random_uuid(), p_template_id, v_snap,
          coalesce(v_tpl.dom, v_tpl.slug || '.quicksites.ai'), now(), 'published', true)
  on conflict (template_id) do update
    set snapshot_id = excluded.snapshot_id, domain = excluded.domain,
        published_at = excluded.published_at, status = 'published', is_public = true;

  perform set_config('app.bypass_template_guard', 'on', true); -- local to this txn
  update public.templates
     set published = true, is_site = true, published_at = now()
   where id = p_template_id;
end $$;

grant execute on function public.publish_template_demo(uuid) to service_role;
