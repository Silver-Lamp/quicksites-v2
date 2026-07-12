// app/api/admin/prospects/backfill-lead-websites/route.ts
//
// Look up migrated legacy leads' websites (Places Text Search) and re-tier the ones that
// actually have a site. PAID — one Places call per prospect — so it only runs on demand,
// admin-gated, and only touches source='legacy_lead' rows still marked 'no_website'.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { backfillLeadWebsites } from '@/lib/outreach/backfillLeadWebsites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* defaults */
  }
  const limit = Math.min(500, Math.max(1, Number(body?.limit) || 200));

  const result = await backfillLeadWebsites(limit);
  return NextResponse.json({ ok: true, result });
}
