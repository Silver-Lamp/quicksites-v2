// app/api/media/assets/route.ts
//
// The image-library API behind the hero editor's picker.
//   POST → record one generated/uploaded image (owner-gated on the template)
//   GET  → list thumbnails for a scope (site | org-industry | org | public)
//
// media_assets is RLS-denied, so all access is via the service-role admin client
// and the gate here is load-bearing (CLAUDE.md §6).

import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/requireUser';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  recordMediaAsset,
  listMediaAssets,
  resolveUserOrgIds,
  type MediaScope,
} from '@/lib/media/mediaAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPES: MediaScope[] = ['site', 'org-industry', 'org', 'public'];

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const templateId = String(body?.template_id ?? '').trim();
  const url = String(body?.url ?? '').trim();
  if (!templateId || !url) {
    return NextResponse.json({ error: 'template_id and url are required' }, { status: 400 });
  }

  // Only the template's owner (or an admin) may attach images to it.
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  const ok = await recordMediaAsset(supabaseAdmin, {
    templateId,
    url,
    storagePath: body?.storage_path ?? null,
    kind: typeof body?.kind === 'string' ? body.kind : 'hero',
    source: body?.source === 'uploaded' ? 'uploaded' : 'generated',
    subject: typeof body?.subject === 'string' ? body.subject : null,
    width: Number.isFinite(body?.width) ? body.width : null,
    height: Number.isFinite(body?.height) ? body.height : null,
  });

  // Best-effort: never let a bookkeeping miss surface as an editor error.
  return NextResponse.json({ ok });
}

export async function GET(req: Request) {
  const gate = await requireUser();
  if (gate instanceof NextResponse) return gate;
  const userId = gate.user.id;

  const { searchParams } = new URL(req.url);
  const rawScope = searchParams.get('scope') || 'org-industry';
  const scope = (SCOPES.includes(rawScope as MediaScope) ? rawScope : 'org-industry') as MediaScope;
  const templateId = searchParams.get('template_id');
  const industry = searchParams.get('industry');
  const kind = searchParams.get('kind');

  // "This site" scope reveals a specific template's images → require ownership.
  if (scope === 'site') {
    if (!templateId) return NextResponse.json({ assets: [] });
    const owner = await requireTemplateOwner(templateId);
    if (!owner.ok) return owner.response;
  }

  const orgIds =
    scope === 'org' || scope === 'org-industry'
      ? await resolveUserOrgIds(supabaseAdmin, userId)
      : [];

  const assets = await listMediaAssets(supabaseAdmin, {
    scope,
    userId,
    orgIds,
    templateId,
    industry,
    kind,
  });

  return NextResponse.json({ assets });
}
