// app/api/partners/brand/domain/route.ts
//
// POST { host } — attach the partner's portal host (Vercel + org_domains) and return the DNS
// record they must add. POST with { check: true } — ask Vercel whether DNS is live and stamp
// verified_at on yes. Middleware serves the host as an app host the moment the row exists
// (lib/partners/whiteLabelRules.ts explains why that is safe).
import { NextResponse } from 'next/server';
import { attachOrgDomain, checkOrgDomain, getPartnerOrg, partnerWhiteLabelStatus, requirePartner } from '@/lib/partners/whiteLabel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel API round-trips

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
  if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    return NextResponse.json({ ok: false, error: 'Custom portal domains are not enabled on the platform yet.' }, { status: 503 });
  }
  try {
    const result = body?.check ? await checkOrgDomain(org) : await attachOrgDomain(org, body?.host);
    return NextResponse.json({ ok: true, result, ...(await partnerWhiteLabelStatus(gate)) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'failed' }, { status: 400 });
  }
}
