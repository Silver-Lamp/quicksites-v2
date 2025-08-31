// app/api/templates/revalidate/route.ts
import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await getServerSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    // 1) refresh the MV
    const { data: ok, error } = await supabase.rpc('admin_refresh_template_bases');
    if (error) throw error;

    // 2) bust any Next.js caches for this area
    revalidateTag('templates');
    revalidatePath('/admin/templates');
    revalidatePath('/admin/templates/list');

    return NextResponse.json({ ok: true, mvRefreshed: !!ok });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'refresh failed' }, { status: 500 });
  }
}
