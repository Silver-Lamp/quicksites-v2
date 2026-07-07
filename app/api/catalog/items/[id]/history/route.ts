// app/api/catalog/items/[id]/history/route.ts
//
// Owner-gated read of an item's inventory adjustment history (the append-only ledger).
// Powers the "History" expander in the merchant inventory screen.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireMerchantOwner } from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: item } = await db.from('catalog_items').select('id, merchant_id').eq('id', id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const gate = await requireMerchantOwner((item as any).merchant_id);
  if (gate instanceof NextResponse) return gate;

  const { data, error } = await db
    .from('inventory_adjustments')
    .select('id, variant_id, delta, new_on_hand, reason, order_id, note, created_at')
    .eq('catalog_item_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ adjustments: data ?? [] });
}
