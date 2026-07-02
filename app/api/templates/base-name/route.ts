// app/api/templates/base-name/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/requireUser';

function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return undefined; }
  }
  return undefined;
}

const sanitizeBaseSlug = (s: string) =>
  (s || '').toString().trim();

const sanitizeDisplayName = (s: string) => {
  const t = (s || '').toString().trim();
  // hard cap for safety (db/UI); adjust as you like
  return t.slice(0, 120);
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  let base_slug = sanitizeBaseSlug(url.searchParams.get('base_slug') || '');
  const template_id = (url.searchParams.get('template_id') || '').trim();

  const supabase = await getServerSupabase();

  // Resolve base_slug from template_id if needed
  let canonFallbackName: string | null = null;
  if (!base_slug && template_id) {
    const { data: trow, error: terr } = await supabase
      .from('templates')
      .select('base_slug,template_name,data')
      .eq('id', template_id)
      .maybeSingle();

    if (terr) return NextResponse.json({ error: terr.message }, { status: 500 });

    base_slug = sanitizeBaseSlug(trow?.base_slug || '');
    const data = safeParse<any>(trow?.data);
    const siteTitle = (data?.meta?.siteTitle || trow?.template_name || '').toString().trim();
    if (siteTitle) canonFallbackName = siteTitle;
  }

  if (!base_slug) {
    return NextResponse.json({ error: 'base_slug or template_id required' }, { status: 400 });
  }

  // Return meta display name if present; else return canonical fallback
  const { data: row, error } = await supabase
    .from('template_base_meta')
    .select('display_name')
    .eq('base_slug', base_slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    display_name: row?.display_name ?? canonFallbackName ?? null,
  });
}

export async function POST(req: Request) {
  // Reject unauthenticated / anonymous callers (was fully open). NOTE: base_slug
  // is shared across duplicated templates so per-owner scoping is ambiguous; this
  // is display-name-only metadata — a stricter owner-of-base check is a follow-up.
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;

  const payload = await req.json().catch(() => ({} as any));
  const base_slug = sanitizeBaseSlug(payload?.base_slug || '');
  const display_name = sanitizeDisplayName(payload?.display_name || '');

  if (!base_slug || !display_name) {
    return NextResponse.json({ error: 'base_slug and display_name required' }, { status: 400 });
  }

  const supabase = await getServerSupabase();

  // Upsert display name for this base (no slug writes anywhere)
  const { error, data } = await supabase
    .from('template_base_meta')
    .upsert({ base_slug, display_name }, { onConflict: 'base_slug' })
    .select('base_slug, display_name')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optional: refresh MV / cache if present; ignore failures
  try {
    await supabase.rpc('refresh_template_bases');
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('refresh_template_bases failed (ignored):', e?.message || e);
  }

  return NextResponse.json({ ok: true, base_slug, display_name: data?.display_name ?? display_name });
}
