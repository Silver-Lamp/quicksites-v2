// app/template/[key]/edit/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import EditWrapper from '@/components/admin/templates/edit-wrapper'; // client component

type Params = { key: string };

// UUID v4 detector to decide if `key` is an ID or a slug
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function TemplateEditPage({
  params, // ✅ Next.js 15: params is a Promise
}: {
  params: Promise<Params>;
}) {
  const { key } = await params; // ✅ must await

  const supabase = await getServerSupabase();

  // Auth (use getUser rather than getSession to avoid security warning)
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(`/login?next=${encodeURIComponent(`/template/${key}/edit`)}`);
  }

  // Admin?
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  // Decide whether key is an id or a slug
  const isId = UUID_V4.test(key);
  let q = supabase.from('templates').select('*').limit(1);
  q = isId ? q.eq('id', key) : q.eq('slug', key);
  if (!adminRow) q = q.eq('owner_id', user.id);

  const { data: template, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!template) return notFound();

  // Pass initialTemplate to avoid a second client fetch
  return isId ? (
    <EditWrapper id={template.id} initialTemplate={template} />
  ) : (
    <EditWrapper slug={template.slug} initialTemplate={template} />
  );
}
