// app/api/admin/compliance/docs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const runtime='nodejs'; export const dynamic='force-dynamic';

export async function GET(req: NextRequest) {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error:'Forbidden' }, { status:403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';   // pending|approved|rejected|expired
  const state = url.searchParams.get('state');                   // optional filter
  const op = url.searchParams.get('op');                         // operation_type
  const limit = Math.min(parseInt(url.searchParams.get('limit')||'50',10), 200);

  let q = supa.from('compliance_docs')
    .select('id, merchant_id, requirement_id, kind, fields, file_url, issued_at, expires_at, status, created_at, merchants(display_name,name), compliance_requirements(code,operation_type:operation_type,juris_state)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (state) q = q.eq('compliance_requirements.juris_state', state);
  if (op) q = q.eq('compliance_requirements.operation_type', op);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status:500 });

  return NextResponse.json({ docs: data || [] });
}
