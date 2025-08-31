// app/api/admin/templates/rename-base/route.ts
import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  try {
    const { old_base, new_base, rename_slugs = false } = await req.json();
    if (!old_base || !new_base) {
      return NextResponse.json({ ok: false, error: 'old_base and new_base required' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

    const { data, error } = await supabase.rpc('admin_rename_template_base', {
      old_base,
      new_base,
      rename_slugs,
    });
    if (error) throw error;

    // Refresh your materialized view (if you added this RPC earlier)
    await supabase.rpc('admin_refresh_template_bases');
    // .catch(() => {});

    revalidatePath('/admin/templates');
    revalidatePath('/admin/templates/list');

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'rename failed' }, { status: 500 });
  }
}
