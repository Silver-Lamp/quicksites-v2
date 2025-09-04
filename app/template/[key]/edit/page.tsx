// app/template/[key]/edit/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import CachedEditWrapper from '@/components/admin/templates/cached-edit-wrapper';

type Params = { key: string };
type SearchParams = { page?: string; preview_version_id?: string; mode?: string };

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT =
  'id,slug,template_name,updated_at,created_at,owner_id,is_site,is_version,archived,industry,color_mode,data,header_block,footer_block,base_slug';

export default async function TemplateEditPage({
  params,
  searchParams,
}: {
  params: { key: string };
  searchParams: Promise<{ page?: string; preview_version_id?: string; mode?: string }>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const initialPageSlug = sp.page ?? null;
  const initialPreviewVersionId = sp.preview_version_id ?? null;
  const initialMode = (sp.mode as string | undefined) ?? undefined;

  const supabase = await getServerSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    const next = `/template/${key}/edit${initialPageSlug ? `?page=${encodeURIComponent(initialPageSlug)}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

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

  const shared = {
    initialTemplate: template,
    initialPageSlug,
    initialPreviewVersionId,
    initialMode,
  };

  return isId ? (
    <CachedEditWrapper id={template.id} {...shared} />
  ) : (
    <CachedEditWrapper slug={template.slug} {...shared} />
  );
}
