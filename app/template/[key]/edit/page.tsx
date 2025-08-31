import { redirect, notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import CachedEditWrapper from '@/components/admin/templates/cached-edit-wrapper'; // ⬅️ use cached wrapper

type Params = { key: string };
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Keep the payload lean; the editor only needs these on first paint
const SELECT =
  'id,slug,template_name,updated_at,created_at,owner_id,is_site,is_version,archived,industry,color_mode,data,header_block,footer_block,base_slug';

export default async function TemplateEditPage({ params }: { params: Promise<Params> }) {
  const { key } = await params;
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(`/login?next=${encodeURIComponent(`/template/${key}/edit`)}`);
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

  return isId ? (
    <CachedEditWrapper id={template.id} initialTemplate={template} />
  ) : (
    <CachedEditWrapper slug={template.slug} initialTemplate={template} />
  );
}
