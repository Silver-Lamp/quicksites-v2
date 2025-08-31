import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseOpenAI } from '@/lib/ai/pricing-scrapers/openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

async function serverAnon() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
    //   cookieEncoding: 'base64url',
      cookies: {
        getAll: async () => (await store).getAll().map(({ name, value }) => ({ name, value })),
        setAll: async (cks) => cks.forEach((c) => store.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
) as AnyClient;

async function requireAdmin() {
  const supa = await serverAnon() as AnyClient;
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;
  const { data: adminRow } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1);
  return adminRow?.[0] ? user : null;
}

function escapeHtml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function primaryMetric(r: any) {
  return r?.input_per_1k_usd ?? r?.image_base_usd ?? r?.stt_per_min_usd ?? r?.tts_per_1k_chars_usd ?? null;
}
function pct(oldVal?: number | null, nextVal?: number | null) {
  if (oldVal == null || nextVal == null || oldVal === 0) return null;
  return Math.abs((nextVal - oldVal) / oldVal) * 100;
}

export async function POST(req: NextRequest) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { text } = await req.json().catch(() => ({}));
  if (!text || typeof text !== 'string' || text.length < 1000) {
    return NextResponse.json({ error: 'Paste the pricing page text (>=1000 chars).' }, { status: 400 });
  }

  // Wrap as <main> so the Cheerio-based parser reads it consistently
  const wrapped = `<main>${escapeHtml(text)}</main>`;
  const parsed = parseOpenAI(wrapped);

  if (!parsed.length) {
    return NextResponse.json({ error: 'Could not parse any model rows from the pasted text.' }, { status: 400 });
  }

  let queued = 0;
  const PROVIDER = 'openai';

  for (const r of parsed) {
    const { data: current } = await admin
      .from('ai_model_pricing')
      .select('*')
      .eq('provider', PROVIDER)
      .eq('model_code', r.model_code)
      .eq('modality', r.modality)
      .maybeSingle();

    const next = {
      provider: PROVIDER,
      model_code: r.model_code,
      modality: r.modality,
      input_per_1k_usd: r.input_per_1k_usd ?? null,
      output_per_1k_usd: r.output_per_1k_usd ?? null,
      image_base_usd: r.image_base_usd ?? null,
      image_per_mp_usd: r.image_per_mp_usd ?? null,
      stt_per_min_usd: r.stt_per_min_usd ?? null,
      tts_per_1k_chars_usd: r.tts_per_1k_chars_usd ?? null,
      is_active: true,
    } as const;

    await admin.from('ai_pricing_audit').insert({
      provider: PROVIDER,
      model_code: r.model_code,
      modality: r.modality,
      old: current || null,
      new: next,
      change_pct: pct(primaryMetric(current), primaryMetric(next)),
      applied: false,
      message: 'manual import',
      action: 'auto-detect',
      reviewer_id: me.id,
    });

    queued++;
  }

  return NextResponse.json({ ok: true, queued, provider: 'openai' });
}
