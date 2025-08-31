import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeTemplate as normalizeTemplateServer } from '@/admin/utils/normalizeTemplate';

const TBL = process.env.NEXT_PUBLIC_TEMPLATES_TABLE || 'templates';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function serverAnon() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: async () => (await store).getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (cks) => cks.forEach(async (c) =>
          (await store).set(c.name, c.value, c.options as CookieOptions | undefined)
        ),
      },
    }
  );
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function requireAdmin() {
  const supa = await serverAnon();
  const { data: { user } } = await (await supa as SupabaseClient).auth.getUser();
  if (!user) return null;
  const { data: row } = await (await supa as SupabaseClient).from('admin_users').select('user_id').eq('user_id', user.id).limit(1);
  return row?.[0] ? user : null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data, error } = await (await admin as SupabaseClient)
    .from(TBL)
    .select('id, data, template_name, slug, industry, layout, color_scheme')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: error?.message || 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, row: data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { dataJson } = await req.json().catch(() => ({}));
  if (dataJson == null) return NextResponse.json({ error: 'dataJson required' }, { status: 400 });

  let parsed: any;
  try {
    parsed = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid JSON: ${e?.message || String(e)}` }, { status: 400 });
  }

  // Accept either a "data" object (meta/pages/…) or a full template shape; normalize either.
  const normalized = normalizeTemplateServer(parsed as any);
  return NextResponse.json({ ok: true, template: normalized, warnings: [] });
}
