// app/api/catalog/items/[id]/adjust/route.ts
//
// Manual inventory adjustment: receive stock (+N), remove (-N), or correct to an
// absolute count (setTo). Applies atomically via the increment/decrement RPCs (so it
// can't race a concurrent sale) and records the change in inventory_adjustments.
// Owner-gated. Only for TRACKED items — enabling tracking is done via the edit drawer.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireMerchantOwner } from '@/lib/auth/requireUser';
import { normalizeStock } from '@/lib/commerce/inventory';
import { resolveManualAdjustment, recordAdjustment } from '@/lib/commerce/inventoryLedger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

/** Current on-hand for a plain item or a specific variant; null = untracked. */
function currentOnHand(metadata: any, variantId: string | null): number | null {
  if (variantId) {
    const v = (Array.isArray(metadata?.variants) ? metadata.variants : []).find((x: any) => x?.id === variantId);
    return v ? normalizeStock(v.stock) : null;
  }
  if (metadata?.track_inventory === false) return null;
  return normalizeStock(metadata?.stock);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    variantId?: string | null;
    delta?: number;
    setTo?: number;
    reason?: 'manual' | 'receive' | 'correction';
    note?: string;
  };

  const { data: item } = await db
    .from('catalog_items')
    .select('id, merchant_id, metadata')
    .eq('id', id)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const gate = await requireMerchantOwner((item as any).merchant_id);
  if (gate instanceof NextResponse) return gate;
  const actorId = gate.user.id;

  const variantId = body.variantId ? String(body.variantId) : null;
  const current = currentOnHand((item as any).metadata, variantId);
  if (current === null) {
    return NextResponse.json(
      { error: 'This item is not tracking quantity. Enable tracking (edit the item) first.' },
      { status: 400 },
    );
  }

  const resolved = resolveManualAdjustment(current, body);
  if (!resolved) return NextResponse.json({ ok: true, unchanged: true, on_hand: current });

  const { delta, reason } = resolved;
  const rpc = delta > 0 ? 'increment_catalog_stock' : 'decrement_catalog_stock';
  const { data: res, error } = await (db as any).rpc(rpc, {
    p_item: id,
    p_variant: variantId,
    p_qty: Math.abs(delta),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (res && res.ok === false) {
    // Removing more than exists (deny policy) — reject with the current count.
    return NextResponse.json(
      { error: `Only ${res.remaining ?? current} on hand.`, on_hand: res.remaining ?? current },
      { status: 409 },
    );
  }

  const newOnHand = typeof res?.remaining === 'number' ? res.remaining : current + delta;
  await recordAdjustment(db, {
    catalogItemId: id, variantId, delta, newOnHand, reason, actorId, note: body.note ?? null,
  });

  return NextResponse.json({ ok: true, on_hand: newOnHand, delta, reason });
}
