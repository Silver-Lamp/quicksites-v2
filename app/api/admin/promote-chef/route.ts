// /app/api/admin/promote-chef/route.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n:string)=>cookieStore.get(n)?.value } as CookieOptions, cookieEncoding: 'base64url' as const } as any
  );

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminRow } = await supa
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();

  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json(); // { user_id, name, ... }
  const supaAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // never expose to client
  );

  const { error } = await supaAdmin.from('chefs').upsert(body);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
