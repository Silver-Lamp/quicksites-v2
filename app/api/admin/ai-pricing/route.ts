import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

async function serverAnon() {
  const store = await cookies(); // sync is fine
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        // match your working pattern
        getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) =>
          cks.forEach((c) =>
            store.set(c.name, c.value, c.options as CookieOptions | undefined)
          ),
      },
    }
  );
}

// server-only service-role client (DB writes)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
) as AnyClient;

async function requireAdmin() {
  const supa = await serverAnon() as AnyClient;
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  // Gate via your admin_users table (matches your working file)
  const { data: adminRow } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1);

  if (!adminRow?.[0]) return null;
  return user;
}

function num(v: any) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { data, error } = await admin
    .from('ai_model_pricing')
    .select('*')
    .order('provider', { ascending: true })
    .order('model_code', { ascending: true })
    .order('modality', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const payload = {
    id: body.id ?? undefined,
    provider: body.provider,
    model_code: body.model_code,
    modality: body.modality,
    input_per_1k_usd: num(body.input_per_1k_usd),
    output_per_1k_usd: num(body.output_per_1k_usd),
    image_base_usd: num(body.image_base_usd),
    image_per_mp_usd: num(body.image_per_mp_usd),
    stt_per_min_usd: num(body.stt_per_min_usd),
    tts_per_1k_chars_usd: num(body.tts_per_1k_chars_usd),
    currency: body.currency ?? 'USD',
    is_active: body.is_active ?? true,
  };

  if (!payload.provider || !payload.model_code || !payload.modality) {
    return NextResponse.json({ error: 'provider, model_code, modality are required' }, { status: 400 });
  }

  const { error } = await admin
    .from('ai_model_pricing')
    .upsert(payload, { onConflict: 'provider,model_code,modality' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const provider = searchParams.get('provider');
  const model_code = searchParams.get('model_code');
  const modality = searchParams.get('modality');

  let qb = admin.from('ai_model_pricing').delete();
  if (id) qb = qb.eq('id', id);
  else if (provider && model_code && modality) {
    qb = qb.eq('provider', provider).eq('model_code', model_code).eq('modality', modality);
  } else {
    return NextResponse.json({ error: 'Missing id or unique keys' }, { status: 400 });
  }

  const { error } = await qb;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
