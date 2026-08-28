// app/template/[key]/edit/page.tsx
import { signInHref } from '@/lib/auth/authLinks';
import { redirect, notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import CachedEditWrapper from '@/components/admin/templates/cached-edit-wrapper';

type Params = { key: string };
type SearchParams = { page?: string; preview_version_id?: string; mode?: string };

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT =
  'id,slug,template_name,updated_at,created_at,owner_id,is_site,is_version,archived,industry,color_mode,data,header_block,footer_block,base_slug';

function buildQueryString(sp: SearchParams) {
  const q = new URLSearchParams();
  if (sp.page) q.set('page', sp.page);
  if (sp.preview_version_id) q.set('preview_version_id', sp.preview_version_id);
  if (sp.mode) q.set('mode', sp.mode);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export default async function TemplateEditPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: Promise<SearchParams>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const qs = buildQueryString(sp);

  const supabase = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    const next = `/template/${key}/edit${qs}`;
    redirect(signInHref(next));
  }

  // Only admins can open non-owned templates
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const isId = UUID_V4.test(key);
  let q = supabase.from('templates').select(SELECT).limit(1);
  q = isId ? q.eq('id', key) : q.eq('slug', key);
  if (!adminRow) q = q.eq('owner_id', user.id);

  const { data: template, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!template) return notFound();

  // If opened by slug, canonicalize to the ID route so
  // all subsequent edits post to /template/{id}/edit (not slug).
  if (!isId) {
    redirect(`/template/${template.id}/edit${qs}`);
  }

  // Optional: if editing a version, canonicalize to base template id
  // so slug edits hit the base authority consistently.
  if (template.is_version && template.base_slug) {
    const { data: base } = await supabase
      .from('templates')
      .select('id')
      .eq('base_slug', template.base_slug)
      .eq('is_version', false)
      .limit(1)
      .maybeSingle();
    if (base?.id && base.id !== template.id) {
      redirect(`/template/${base.id}/edit${qs}`);
    }
  }

  const shared = {
    initialTemplate: template,
    initialPageSlug: sp.page ?? null,
    initialPreviewVersionId: sp.preview_version_id ?? null,
    initialMode: (sp.mode as string | undefined) ?? undefined,
  };

  return <CachedEditWrapper id={template.id} {...shared} />;
}
