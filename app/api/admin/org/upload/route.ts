// app/api/admin/org/upload/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { uploadOrgAsset } from '@/lib/org/orgAssetUpload';

// The image pipeline lives in lib/org/orgAssetUpload.ts, shared with the partner self-serve
// route (app/api/partners/brand/logo) so both write identical assets to the same bucket.

function j(data: any, init?: number | ResponseInit) {
  const resInit = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, resInit);
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const org_id = String(form.get('org_id') || '').trim();
    const org_slug = String(form.get('org_slug') || '').trim();
    const tag = String(form.get('tag') || 'logo').trim();

    if (!file) return j({ error: 'file required' }, 400);
    if (!org_id || !org_slug) return j({ error: 'org_id and org_slug required' }, 400);

    const inType = file.type || 'application/octet-stream';
    const asset = await uploadOrgAsset(file, { orgId: org_id, orgSlug: org_slug, tag });
    return j({ ok: true, ...asset, originalType: inType });
  } catch (e: any) {
    const msg = e?.message || 'upload failed';
    const status = /unsupported type/.test(msg) ? 415 : /too large/.test(msg) ? 413 : 500;
    return j({ error: msg }, status);
  }
}
