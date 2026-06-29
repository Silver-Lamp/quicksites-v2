-- Sanctioned publish for server-generated demo sites: snapshot + published_sites
-- pointer + published/is_site flags, past the templates-update guard. SECURITY
-- DEFINER so the route (service role) can publish without direct guarded writes.
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

  select id into v_snap
    from public.template_versions
   where template_id = p_template_id
   order by created_at desc
   limit 1;

  if v_snap is null then
    insert into public.template_versions (id, template_id, template_name, full_data, created_at, commit_message)
    values (gen_random_uuid(), p_template_id, v_tpl.template_name, v_tpl.data, now(), 'auto-publish (demo)')
    returning id into v_snap;
  end if;

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
