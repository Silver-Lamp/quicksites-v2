// app/api/partners/brand/email-domain/route.ts
//
// POST { domain } — register the partner's sending domain with Resend and return its DNS
// records. POST { check: true } — re-verify; once Resend reports `verified`, the org's
// `email_from` is set and lib/email.ts sends every merchant email from their domain.
import { NextResponse } from 'next/server';
import { checkEmailDomain, createEmailDomain, getPartnerOrg, partnerWhiteLabelStatus, requirePartner } from '@/lib/partners/whiteLabel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const gate = await requirePartner();
  if (gate instanceof NextResponse) return gate;
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const org = await getPartnerOrg(gate.user.id);
  if (!org) return NextResponse.json({ ok: false, error: 'Save your brand first.' }, { status: 400 });
  try {
    const result = body?.check ? await checkEmailDomain(org) : await createEmailDomain(org, body?.domain);
    return NextResponse.json({ ok: true, result, ...(await partnerWhiteLabelStatus(gate)) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 400 });
  }
}
