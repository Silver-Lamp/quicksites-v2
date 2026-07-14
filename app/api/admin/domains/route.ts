// app/api/admin/domains/route.ts
//
// Owned-domain recurring-cost surface (admin-only).
//   GET                      → merged inventory + rollup + 12-month spend projection
//   POST { action:'sync' }   → refresh the cost ledger from Vercel (renewal prices + expiry)
//   POST { domain, renewalCents?, registrar?, expiresAt?, notes? }
//                            → upsert a manual/external domain's cost (the follow-up for
//                              domains registered outside Vercel)

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { assembleOwnedInventory, syncOwnedDomains, upsertManualDomain } from '@/lib/domains/ownedInventoryServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const months = Math.max(1, Math.min(36, Number(new URL(req.url).searchParams.get('months')) || 12));
  try {
    const inv = await assembleOwnedInventory(months);
    return NextResponse.json({ ok: true, ...inv });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'inventory_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  if (body?.action === 'sync') {
    const r = await syncOwnedDomains();
    if (!r.ok) return NextResponse.json(r, { status: r.error === 'vercel_unavailable' ? 502 : 500 });
    return NextResponse.json(r);
  }

  if (typeof body?.domain === 'string' && body.domain.trim()) {
    const r = await upsertManualDomain({
      domain: body.domain,
      renewalCents:
        body.renewalCents === null ? null
        : body.renewalCents !== undefined ? Math.max(0, Math.round(Number(body.renewalCents) || 0))
        : undefined,
      registrar: typeof body.registrar === 'string' ? body.registrar.trim() || null : undefined,
      expiresAt: typeof body.expiresAt === 'string' ? (body.expiresAt.trim() || null) : undefined,
      notes: typeof body.notes === 'string' ? (body.notes.trim() || null) : undefined,
    });
    if (!r.ok) return NextResponse.json(r, { status: 400 });
    return NextResponse.json(r);
  }

  return NextResponse.json({ ok: false, error: 'nothing_to_do' }, { status: 400 });
}
