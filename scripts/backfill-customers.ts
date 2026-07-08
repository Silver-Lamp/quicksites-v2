// scripts/backfill-customers.ts
//
// CRM Phase 1 backfill: give historical paid orders a customer record.
//
// The customer identity spine (Phase 0) only fires at markOrderPaid, so orders paid
// BEFORE it shipped have no customer_id and are invisible in /merchant/customers.
// This one-off parses each such order's succeeded payment (payments.raw — the Stripe
// event/session) for the buyer, then calls the same upsert_customer_from_order RPC
// the live path uses, and links the order (customer_id + denormalized customer_email).
//
//   npm run backfill:customers            # dry run — scan + report, writes nothing
//   npm run backfill:customers -- --apply # actually upsert + link
//   npm run backfill:customers -- --apply --limit 100
//
// Idempotent: only orders with customer_id IS NULL are processed, so re-running skips
// everything already linked (no double-counting of orders_count / lifetime_cents).
// Orders are walked oldest-first (keyset cursor) so first_order_at lands on a
// customer's earliest order and last_order_at climbs from there.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// supabase-js pulls in realtime, which needs a WebSocket global on Node < 22.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { extractBuyerFromStripeEvent, normalizeEmail } from '@/lib/commerce/customers';

const PAGE = 200;

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Math.max(0, parseInt(process.argv[limitArg + 1] || '0', 10)) : 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n▶ Backfilling customers from paid orders (${apply ? 'APPLY' : 'DRY RUN'}${limit ? `, limit ${limit}` : ''})…\n`);

  const stats = {
    scanned: 0,
    linked: 0,       // orders we (would) link to a customer
    noEmail: 0,      // paid orders whose payment carried no usable buyer email
    noPayment: 0,    // orders with no succeeded payment / raw to parse
    noMerchant: 0,   // orders missing merchant_id (can't scope a customer)
    errors: 0,
  };
  const emails = new Set<string>();

  // Keyset cursor on (created_at, id) — always advances past the last row of each
  // page, so every candidate order is visited exactly once whether or not it ends
  // up linked. Monotonic ⇒ no infinite loop on rows that can't be linked and never
  // leave the `customer_id is null` filter.
  let cursorCreated: string | null = null;
  let cursorId: string | null = null;

  for (;;) {
    if (limit && stats.linked >= limit) break;

    let q = db
      .from('orders')
      .select('id, merchant_id, total_cents, created_at')
      .is('customer_id', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(PAGE);
    if (cursorCreated && cursorId) {
      q = q.or(`created_at.gt.${cursorCreated},and(created_at.eq.${cursorCreated},id.gt.${cursorId})`);
    }
    const { data: orders, error } = await q;
    if (error) { console.error('❌ order query failed:', error.message); process.exit(1); }
    if (!orders || orders.length === 0) break;

    // Advance the cursor to the last row of the page before processing.
    const last = orders[orders.length - 1] as any;
    cursorCreated = last.created_at;
    cursorId = last.id;

    // Batch-fetch the succeeded payments for this page of orders.
    const ids = orders.map((o: any) => o.id);
    const { data: payments } = await db
      .from('payments')
      .select('order_id, raw, amount_cents, created_at')
      .in('order_id', ids)
      .eq('state', 'succeeded')
      .order('created_at', { ascending: true });
    const payByOrder = new Map<string, any>();
    for (const p of payments ?? []) {
      if (!payByOrder.has(p.order_id)) payByOrder.set(p.order_id, p); // first succeeded payment
    }

    for (const o of orders as any[]) {
      if (limit && stats.linked >= limit) break;
      stats.scanned++;

      if (!o.merchant_id) { stats.noMerchant++; continue; }
      const pay = payByOrder.get(o.id);
      if (!pay || !pay.raw) { stats.noPayment++; continue; }

      const buyer = extractBuyerFromStripeEvent(pay.raw);
      if (!buyer) { stats.noEmail++; continue; }

      const email = normalizeEmail(buyer.email);
      if (email) emails.add(`${o.merchant_id}:${email}`);

      const totalCents = Math.max(0, Math.trunc(pay.amount_cents ?? o.total_cents ?? 0));
      const atIso = new Date(pay.created_at ?? o.created_at ?? Date.now()).toISOString();

      if (!apply) { stats.linked++; continue; }

      try {
        const { data: customerId, error: rpcErr } = await db.rpc('upsert_customer_from_order', {
          p_merchant: o.merchant_id,
          p_email: buyer.email,
          p_name: buyer.name ?? null,
          p_phone: buyer.phone ?? null,
          p_stripe: buyer.stripeCustomerId ?? null,
          p_total: totalCents,
          p_at: atIso,
        });
        if (rpcErr) { console.warn(`  ⚠ order ${o.id.slice(0, 8)}: upsert failed — ${rpcErr.message}`); stats.errors++; continue; }
        const { error: updErr } = await db
          .from('orders')
          .update({ customer_id: customerId ?? null, customer_email: email })
          .eq('id', o.id);
        if (updErr) { console.warn(`  ⚠ order ${o.id.slice(0, 8)}: link failed — ${updErr.message}`); stats.errors++; continue; }
        stats.linked++;
      } catch (e: any) {
        console.warn(`  ⚠ order ${o.id.slice(0, 8)}: ${e?.message || e}`);
        stats.errors++;
      }
    }

    if (orders.length < PAGE) break;
  }

  console.log('\n── Summary ─────────────────────────────');
  console.log(`  scanned orders       ${stats.scanned}`);
  console.log(`  ${apply ? 'linked' : 'would link'} to customer  ${stats.linked}`);
  console.log(`  distinct customers   ${emails.size}`);
  console.log(`  paid, no buyer email ${stats.noEmail}`);
  console.log(`  no succeeded payment ${stats.noPayment}`);
  console.log(`  missing merchant_id  ${stats.noMerchant}`);
  if (stats.errors) console.log(`  errors               ${stats.errors}`);
  console.log('────────────────────────────────────────');
  if (!apply) console.log('\nDry run — nothing written. Re-run with --apply to backfill.\n');
  else console.log('\n✓ Backfill complete.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
