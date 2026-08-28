-- A publish path that actually works from the app.
--
-- app/api/templates/[id]/publish/route.ts performs a plain UPDATE on public.templates,
-- which trg_guard_templates_update rejects unconditionally:
--   ERROR: Direct updates to templates are blocked. Use app.commit_template().
-- Verified 2026-08-28 by running the route's exact statement in a rolled-back transaction.
-- The route surfaces that as a 400, so the admin Publish button has been failing LOUDLY
-- with a Postgres message ever since the guard landed. Every site published so far went
-- through publish_template_demo from a script, never through the UI.
--
-- ⚠️ Flipping templates.published is NOT sufficient to publish. The public render serves
-- the snapshot recorded in published_sites, so a route that only set the flag would produce
-- a site marked published with nothing to serve — a worse failure than the current one,
-- because it looks like success. This function therefore does the whole job, mirroring
-- public.publish_template_demo (the misnamed generic helper) and adding the two things the
-- route needs and that helper drops: the version actually published, and who published it.
--
-- Do NOT reach for public.publish_site / app.publish_site — both exist, neither works
-- (they raise `relation "app.snapshots" does not exist`).

create or replace function public.publish_template(
  p_template_id uuid,
  p_version_id  uuid default null,
  p_actor       uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snap uuid;
  v_tpl  record;
begin
  select id, slug, template_name, data,
         coalesce(nullif(custom_domain, ''), nullif(domain, '')) as dom
    into v_tpl
    from public.templates
   where id = p_template_id;
  if not found then
    raise exception 'template % not found', p_template_id;
  end if;

  if p_version_id is not null then
    -- Publish a named snapshot, but only one belonging to THIS template: a version id is
    -- caller-supplied, and publishing another template's snapshot would serve one site's
    -- content at another site's address.
    select id into v_snap
      from public.template_versions
     where id = p_version_id and template_id = p_template_id;
    if v_snap is null then
      raise exception 'version % does not belong to template %', p_version_id, p_template_id;
    end if;
  else
    -- Mint a fresh immutable snapshot of current data; never silently reuse an old one.
    insert into public.template_versions (id, template_id, template_name, full_data, created_at, commit_message)
    values (gen_random_uuid(), p_template_id, v_tpl.template_name, v_tpl.data, now(), 'publish')
    returning id into v_snap;
  end if;

  insert into public.published_sites (id, template_id, snapshot_id, domain, published_at, status, is_public)
  values (gen_random_uuid(), p_template_id, v_snap,
          coalesce(v_tpl.dom, v_tpl.slug || '.quicksites.ai'), now(), 'published', true)
  on conflict (template_id) do update
    set snapshot_id  = excluded.snapshot_id,
        domain       = excluded.domain,
        published_at = excluded.published_at,
        status       = 'published',
        is_public    = true;

  perform set_config('app.bypass_template_guard', 'on', true); -- local to this txn only
  update public.templates
     set published            = true,
         is_site              = true,
         published_version_id = v_snap,
         published_at         = now(),
         published_by         = coalesce(p_actor, published_by)
   where id = p_template_id;

  return v_snap;
end
$$;

comment on function public.publish_template(uuid, uuid, uuid) is
  'Sanctioned publish: snapshot -> published_sites -> flip the pointer, inside the guard bypass. The route CANNOT do this with a plain UPDATE. Returns the snapshot id actually published.';

revoke all on function public.publish_template(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_template(uuid, uuid, uuid) to service_role;
