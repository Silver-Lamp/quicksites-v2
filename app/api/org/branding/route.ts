// app/api/org/branding/route.ts
//
// White-label branding for the auth surface (login / join / register). Resolves
// the current org host→org and returns its brand only when it's a reseller org;
// otherwise 404 so clients fall through to QuickSites defaults. Consumed by
// app/login/LoginForm.tsx, app/login/login-client.tsx, app/admin/register.tsx,
// and hooks/useOrgBranding.ts. See docs/WHITE_LABEL_PLAN.md (Slice 0).
import { NextResponse } from 'next/server';
import { resolveOrg } from '@/lib/org/resolveOrg';
import { buildOrgBranding } from '@/lib/org/branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const org = await resolveOrg();
  const branding = buildOrgBranding(org);

  // Not a reseller org → behave as if the endpoint doesn't exist (the callers
  // already treat a non-200 as "no API branding" and use their own fallbacks).
  if (!branding) {
    return NextResponse.json({ branded: false }, { status: 404 });
  }

  return NextResponse.json(branding, {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=60' },
  });
}
