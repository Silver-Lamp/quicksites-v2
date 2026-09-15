// app/api/partners/brand/logo/route.ts
//
// POST multipart { file, tag: logo | dark_logo | favicon } — the partner's own org only. Same
// pipeline as the platform-admin upload (lib/org/orgAssetUpload.ts); the URL is written straight
// onto the org column so the surfaces gated on billing_mode='reseller' pick it up.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { uploadOrgAsset } from '@/lib/org/orgAssetUpload';
import { getPartnerOrg, partnerWhiteLabelStatus, requirePartner } from '@/lib/partners/whiteLabel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMN: Record<string, 'logo_url' | 'dark_logo_url' | 'favicon_url'> = {
  logo: 'logo_url',
  dark_logo: 'dark_logo_url',
  favicon: 'favicon_url',
};

export async function POST(req: Request) {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  const org = await getPartnerOrg(gate.user.id);
  if (!org) return NextResponse.json({ ok: false, error: 'Save your brand first.' }, { status: 400 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    const tag = String(form.get('tag') || 'logo');
    const column = COLUMN[tag];
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
    if (!column) return NextResponse.json({ ok: false, error: 'tag must be logo, dark_logo or favicon' }, { status: 400 });
    const asset = await uploadOrgAsset(file, { orgId: org.id, orgSlug: org.slug, tag });
    const { error } = await (supabaseAdmin as any)
      .from('organizations')
      .update({ [column]: asset.url, updated_at: new Date().toISOString() })
      .eq('id', org.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, url: asset.url, ...(await partnerWhiteLabelStatus(gate)) });
  } catch (e: any) {
    const msg = e?.message ?? 'upload failed';
    const status = /unsupported type/.test(msg) ? 415 : /too large/.test(msg) ? 413 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
