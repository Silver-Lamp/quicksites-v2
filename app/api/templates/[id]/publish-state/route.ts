// GET /api/templates/<id>/publish-state — does the live site match the latest saved draft?
// Owner or admin only. Reads the draft, the platform snapshot (published_sites →
// template_versions.full_data) and the custom-domain snapshot (sites → snapshots.data) and
// answers with lib/templates/publishState.ts. Read-only; nothing is written.
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publishStateFor } from '@/lib/templates/publishState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const gate = await requireTemplateOwner(id);
  if (!gate.ok) return gate.response;

  const { data: tpl } = await supabaseAdmin.from('templates').select('id, data, published, custom_domain').eq('id', id).maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: ps } = await supabaseAdmin.from('published_sites').select('snapshot_id, published_at, domain').eq('template_id', id).maybeSingle();
  let platform: unknown | null = null;
  if (ps?.snapshot_id) {
    const { data: tv } = await supabaseAdmin.from('template_versions').select('full_data').eq('id', ps.snapshot_id).maybeSingle();
    platform = (tv as any)?.full_data ?? null;
  }

  let domain: unknown | null = null;
  let domainHost: string | null = null;
  const { data: siteRow } = await supabaseAdmin.from('sites').select('domain, published_snapshot_id').eq('template_id', id).not('domain', 'is', null).limit(1).maybeSingle();
  if (siteRow?.published_snapshot_id) {
    const { data: snap } = await supabaseAdmin.from('snapshots').select('data').eq('id', siteRow.published_snapshot_id).maybeSingle();
    domain = (snap as any)?.data ?? null;
    domainHost = (siteRow as any).domain ?? null;
  }

  const state = publishStateFor({ draft: (tpl as any).data, platform, domain, publishedAt: (ps as any)?.published_at ?? null });
  return NextResponse.json({ ok: true, ...state, domainHost, platformDomain: (ps as any)?.domain ?? null }, { headers: { 'cache-control': 'no-store' } });
}
