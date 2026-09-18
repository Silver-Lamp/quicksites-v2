// app/api/admin/templates/[id]/redirects/route.ts
//
// Read / replace a site's redirect map (`data.meta.redirects`, lib/sites/redirects.ts).
//   GET  → { redirects }
//   PUT  { redirects: [{ from, to, permanent? }] } → validated, normalised, committed through
//         the sanctioned commit RPC (direct template UPDATEs are trigger-blocked, CLAUDE.md §8)
// Admin-only for now: the first use is a WordPress → QuickSites migration done by us. The map
// takes effect on the next request; a published site serves its snapshot, so republish after.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { parseSiteRedirects } from '@/lib/sites/redirects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadTemplate(id: string) {
  const { data, error } = await supabaseAdmin.from('templates').select('id, slug, rev, data, published').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as { id: string; slug: string | null; rev: number | null; data: any; published: boolean | null } | null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const tpl = await loadTemplate(id);
  if (!tpl) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  return NextResponse.json({ redirects: parseSiteRedirects(tpl.data?.meta?.redirects) });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body?.redirects)) {
    return NextResponse.json({ error: 'Body must be { redirects: [{ from, to, permanent? }] }.' }, { status: 400 });
  }
  const redirects = parseSiteRedirects(body.redirects);
  const dropped = body.redirects.length - redirects.length;

  const tpl = await loadTemplate(id);
  if (!tpl) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

  const next = { ...(tpl.data ?? {}), meta: { ...(tpl.data?.meta ?? {}), redirects } };
  const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: next }, gate.user.id);
  if (err) return NextResponse.json({ error: err }, { status: 500 });

  return NextResponse.json({
    ok: true,
    redirects,
    dropped,
    note: tpl.published ? 'Republish the site for the map to reach the served snapshot.' : 'Takes effect on publish.',
  });
}
