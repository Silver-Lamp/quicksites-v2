import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { estimateSeedRunCost } from '@/lib/ai/cost/estimateSeedRun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serverAnon() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: async () => (await store).getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (cks) => {
          for (const c of cks) {
            (await store).set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
}

async function requireAdmin() {
  const supa = serverAnon();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: adminRow } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).limit(1);
  return adminRow?.[0] ? user : null;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  try {
    const result = await estimateSeedRunCost(admin as any, body); // returns { total, breakdown }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'estimate failed' }, { status: 500 });
  }
}
