// app/api/admin/sales/adopt-domain/route.ts
// Register an already-live domain we own as rentable inventory (admin-gated).
//   POST -> { host } -> { ok, campaignId, domain, notes } | 409 with a reason a human can act on
//
// Writes one `geo_industry_campaigns` row pointing at the domain's EXISTING template. It does not
// build a site, buy a domain, or spend anything.
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { adoptRankedDomain } from '@/lib/sales/adoptRankedDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const host = String(body.host ?? '').trim();
  if (!host) return NextResponse.json({ error: 'A host is required.' }, { status: 400 });

  const result = await adoptRankedDomain(host, operator.id);
  if (!result.ok) {
    // 404 only when nothing backs the domain; every other refusal is a fixable data gap, and the
    // detail names the fix rather than the rule.
    const status = result.reason === 'not-found' ? 404 : 409;
    return NextResponse.json(
      { error: result.detail, code: result.reason, campaignId: result.existingCampaignId ?? null },
      { status },
    );
  }
  return NextResponse.json(result);
}
