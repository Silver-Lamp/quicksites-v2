// app/api/admin/media/sender-asset/route.ts
//
// Record an operator-owned outreach image (headshot/signature) in the media_assets registry
// so it can be reused via the picker's "All my sites" scope. Not tied to a template. Admin-
// gated; media_assets is RLS-denied so this route's authorization is load-bearing (CLAUDE.md §6).
//   POST { url, kind: 'headshot' | 'signature', storage_path? } -> { ok }

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { recordOwnerMediaAsset } from '@/lib/media/mediaAssets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_KINDS = new Set(['headshot', 'signature']);

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const url = String(body?.url ?? '').trim();
  const kind = String(body?.kind ?? '').trim();
  if (!url) return NextResponse.json({ error: 'url is required.' }, { status: 400 });
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: 'kind must be "headshot" or "signature".' }, { status: 400 });
  }

  const ok = await recordOwnerMediaAsset(supabaseAdmin, {
    ownerId: operator.id,
    url,
    kind,
    storagePath: typeof body?.storage_path === 'string' ? body.storage_path : null,
  });
  return NextResponse.json({ ok });
}
