import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');
    const raw = url.searchParams.get('slug') || '';
    const excludeMealId = url.searchParams.get('excludeMealId') || null;

    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    let base = slugify(raw);
    if (!base) return NextResponse.json({ error: 'empty slug' }, { status: 400 });
    if (RESERVED_SLUGS.has(base)) base = `${base}-meal`;

    // exact clash?
    const { data: clash } = await db
      .from('meals')
      .select('id')
      .eq('site_id', siteId)
      .eq('slug', base)
      .maybeSingle();

    const taken = !!(clash && (!excludeMealId || clash.id !== excludeMealId));
    if (!taken) {
      return NextResponse.json({ ok: true, available: true, normalized: base });
    }

    // find first available suffix
    let suggestion = base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}-${i}`;
      const { data: c } = await db
        .from('meals').select('id')
        .eq('site_id', siteId)
        .eq('slug', candidate)
        .maybeSingle();
      if (!c) { suggestion = candidate; break; }
    }

    return NextResponse.json({ ok: true, available: false, normalized: base, suggestion });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
