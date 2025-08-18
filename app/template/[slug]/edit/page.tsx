// app/template/[slug]/edit/page.tsx
import { redirect } from 'next/navigation';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import AdminChrome from '@/components/admin/admin-chrome';
import ClientEditor from './ClientEditor';

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await getSupabaseRSC();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/template/${slug}/edit`)}`);

  return (
    <AdminChrome>
      <ClientEditor slug={slug} />
    </AdminChrome>
  );
}
