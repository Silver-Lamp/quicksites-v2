// app/api/sites/theme/route.ts
//
// Publish a new accent + backdrop for a site, from the owner tools on the live page.
//
// ⚠️ OWNER-GATED, AND THE SLUG IS RESOLVED SERVER-SIDE. The caller sends a slug because that is
// what the public page knows about itself; the template id is looked up here and the ownership
// check runs against that id. A body that named the template directly would be a request to write
// to "whichever template I say" — the shape of every IDOR bug ever written.
//
// ⚠️ THIS BOTH COMMITS AND PUBLISHES, WHICH IS WHY THE UI CONFIRMS FIRST. `published_sites` is the
// truth for what a visitor sees (docs/CUSTOM_SITES.md §3), so committing alone would change
// nothing live and quietly look broken to whoever pressed the button. Doing both is correct and
// consequential — a live page can be open in a stranger's browser at that moment.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { BACKDROP_STYLES } from '@/lib/theme/backdrops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Only the free, pure-CSS styles. `painterly` costs money to generate and is not shuffleable. */
const SHUFFLEABLE = BACKDROP_STYLES.filter((s) => s !== 'painterly');
const HEX = /^#[0-9a-f]{6}$/i;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const slug = String(body?.slug ?? '').trim();
  const accent = String(body?.accent ?? '').trim();
  const backdrop = String(body?.backdrop ?? '').trim();

  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });
  // Validate before touching anything: an unvalidated colour reaches a stylesheet, and an
  // unvalidated backdrop name reaches a renderer that has to guess what to do with it.
  if (!HEX.test(accent)) return NextResponse.json({ error: 'accent must be #rrggbb' }, { status: 400 });
  if (!SHUFFLEABLE.includes(backdrop as any)) {
    return NextResponse.json({ error: 'unknown backdrop style' }, { status: 400 });
  }

  const admin = db();
  const { data: row } = await admin
    .from('templates')
    .select('id, rev, data')
    .eq('slug', slug)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'No such site' }, { status: 404 });

  const gate = await requireTemplateOwner((row as any).id);
  if (!gate.ok) return gate.response;

  const data: any = (row as any).data ?? {};
  data.meta = data.meta ?? {};
  data.meta.theme = { ...(data.meta.theme ?? {}), accent };
  // Preserve any intensity the owner already chose; only the style is being shuffled.
  data.meta.backdrop = { ...(data.meta.backdrop ?? {}), style: backdrop };

  await commitTemplatePatch((row as any).id, (row as any).rev ?? 0, { data }, gate.userId ?? null);

  const { error } = await admin.rpc('publish_template_demo', { p_template_id: (row as any).id } as any);
  if (error) {
    // Committed but not published: say so precisely rather than reporting a flat failure, because
    // the two states need different follow-ups.
    return NextResponse.json(
      { ok: false, error: `Saved, but publishing failed: ${error.message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, accent, backdrop });
}
