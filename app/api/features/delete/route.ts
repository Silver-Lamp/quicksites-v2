import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { requireAdmin } from '@/lib/auth/requireUser';

export async function POST(req: NextRequest) {
  // features is the public marketing catalog — platform admins only. The
  // features_admin_write RLS policy backstops the user-client delete below.
  const adminGate = await requireAdmin();
  if (adminGate instanceof NextResponse) return adminGate;

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { error } = await supabase.from('features').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
