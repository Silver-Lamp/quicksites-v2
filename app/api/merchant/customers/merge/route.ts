// app/api/merchant/customers/merge/route.ts
//
// POST — merchant folds duplicate customers into one survivor (CRM_PLAN.md Phase 2).
// customers is deny-default RLS (service-role writes only), so we resolve the
// survivor's merchant, gate on ownership (requireMerchantOwner), then merge via the
// service role. The merge helper re-validates every id belongs to that merchant.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser, requireMerchantOwner } from '@/lib/auth/requireUser';
import { mergeCustomers } from '@/lib/crm/merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    survivorId?: string;
    loserIds?: unknown;
  };
  const survivorId = String(body.survivorId ?? '').trim();
  const loserIds = Array.isArray(body.loserIds)
    ? body.loserIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];

  if (!survivorId || loserIds.length === 0) {
    return NextResponse.json({ error: 'survivorId and loserIds are required' }, { status: 400 });
  }

  // Auth-gate before the (service-role) customer lookup, so an anonymous caller can't
  // probe customer-id existence via the 404-vs-403 response.
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const svc = await getServerSupabase({ serviceRole: true });
  const { data: cust, error: readErr } = await (svc as any)
    .from('customers')
    .select('id, merchant_id')
    .eq('id', survivorId)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });
  if (!cust) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const gate = await requireMerchantOwner(cust.merchant_id);
  if (gate instanceof NextResponse) return gate;

  const result = await mergeCustomers(svc as any, {
    merchantId: cust.merchant_id,
    survivorId,
    loserIds,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, survivorId: result.survivorId, merged: result.merged });
}
