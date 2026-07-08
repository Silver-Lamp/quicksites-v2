// app/api/merchant/customers/[id]/route.ts
//
// PATCH — merchant edits a customer record: notes, tags, marketing consent.
// customers is deny-default RLS (service-role writes only), so we resolve the
// customer's merchant, gate on ownership (requireMerchantOwner), then write via
// the service role. Identity/rollup fields (email, LTV, orders_count) are NOT
// editable here — they're owned by the paid-order spine.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { requireUser, requireMerchantOwner } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    notes?: string | null;
    tags?: unknown;
    marketingConsent?: boolean;
  };

  // Auth-gate before touching the (service-role) customer lookup, so an anonymous
  // caller can't probe customer-id existence via the 404-vs-403 response.
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  // Service role: customers is RLS-deny for authed writes. Resolve merchant first.
  const svc = await getServerSupabase({ serviceRole: true });
  const { data: cust, error: readErr } = await (svc as any)
    .from('customers')
    .select('id, merchant_id')
    .eq('id', id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 400 });
  if (!cust) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const gate = await requireMerchantOwner(cust.merchant_id);
  if (gate instanceof NextResponse) return gate;

  const patch: Record<string, any> = {};
  if ('notes' in body) {
    const n = String(body.notes ?? '').slice(0, 5000).trim();
    patch.notes = n || null;
  }
  if ('marketingConsent' in body) patch.marketing_consent = !!body.marketingConsent;
  if ('tags' in body) {
    const raw = Array.isArray(body.tags) ? body.tags : [];
    // Dedupe, trim, cap length + count so a tag list can't grow unbounded.
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const t of raw) {
      const s = String(t ?? '').trim().slice(0, 40);
      if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); tags.push(s); }
      if (tags.length >= 40) break;
    }
    patch.tags = tags;
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, unchanged: true });
  patch.updated_at = new Date().toISOString();

  const { data, error } = await (svc as any)
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, id: data.id });
}
