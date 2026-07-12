// app/api/admin/prospects/migrate-leads/route.ts
//
// Migrate the legacy `leads` table into the canonical `outreach_prospects` model (Growth
// unification). DRY-RUN BY DEFAULT — POST {} reports what would move without writing; pass
// { execute: true } to actually run it (idempotent — re-running skips already-migrated
// leads). Admin-gated. See lib/outreach/migrateLeads.ts.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { planLeadMigration, runLeadMigration } from '@/lib/outreach/migrateLeads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = dry run */
  }

  const plan = await planLeadMigration();
  if (body?.execute !== true) {
    return NextResponse.json({ ok: true, dryRun: true, plan });
  }

  const result = await runLeadMigration();
  return NextResponse.json({ ok: true, dryRun: false, plan, result });
}
