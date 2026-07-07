import { NextRequest, NextResponse } from 'next/server';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { lowStockTransitions, type InventoryRow } from '@/lib/commerce/inventorySummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Low-stock watchdog (INVENTORY_PLAN.md Phase 2). Scans tracked catalog items and
// emails each merchant a digest of items that just went low/out of stock. Alerts only
// on the transition INTO low (metadata.low_stock_alerted flag) and clears the flag on
// restock, so a daily run never re-spams a persistently-low item.
//
// Off unless LOW_STOCK_ALERTS_ENABLED=1. Runs daily (vercel.json).

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('low-stock-alert', async () => {
    if (!/^(1|true|yes)$/i.test(String(process.env.LOW_STOCK_ALERTS_ENABLED ?? ''))) {
      return NextResponse.json({ ok: true, skipped: 'disabled' });
    }
    const db = await getServerSupabase({ serviceRole: true });

    const { data: items } = await (db as any)
      .from('catalog_items')
      .select('id, merchant_id, title, type, status, metadata')
      .eq('status', 'active')
      .limit(5000);

    const { alert, clearIds } = lowStockTransitions(items ?? []);

    // Clear the flag on restocked items (batch; merge metadata per row).
    const byId = new Map<string, any>((items ?? []).map((i: any) => [i.id, i]));
    for (const id of clearIds) {
      const meta = { ...(byId.get(id)?.metadata ?? {}) };
      delete meta.low_stock_alerted;
      await (db as any).from('catalog_items').update({ metadata: meta }).eq('id', id);
    }

    // Group newly-low items by merchant, email a digest, set the flag.
    const byMerchant = new Map<string, InventoryRow[]>();
    for (const row of alert) {
      const merchantId = byId.get(row.id)?.merchant_id;
      if (!merchantId) continue;
      if (!byMerchant.has(merchantId)) byMerchant.set(merchantId, []);
      byMerchant.get(merchantId)!.push(row);
    }

    let emailed = 0;
    for (const [merchantId, rows] of byMerchant) {
      const email = await merchantOwnerEmail(db, merchantId);
      if (email) {
        try {
          await sendEmail({ to: email, subject: lowStockSubject(rows), html: lowStockHtml(rows) });
          emailed += 1;
        } catch (e: any) {
          console.warn('[low-stock-alert] email failed:', e?.message || e);
        }
      }
      // Flag the items regardless of email success so we don't retry-spam next run.
      for (const row of rows) {
        const meta = { ...(byId.get(row.id)?.metadata ?? {}), low_stock_alerted: true };
        await (db as any).from('catalog_items').update({ metadata: meta }).eq('id', row.id);
      }
    }

    return NextResponse.json({ ok: true, alerted: alert.length, cleared: clearIds.length, merchants_emailed: emailed });
  });
}

async function merchantOwnerEmail(db: any, merchantId: string): Promise<string | null> {
  const { data: m } = await db.from('merchants').select('owner_id, user_id, email').eq('id', merchantId).maybeSingle();
  if (m?.email) return String(m.email);
  const uid = m?.owner_id ?? m?.user_id;
  if (!uid) return null;
  const { data: prof } = await db.from('user_profiles').select('email').eq('user_id', uid).maybeSingle();
  if (prof?.email) return String(prof.email);
  try {
    const { data } = await db.auth.admin.getUserById(uid);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

function lowStockSubject(rows: InventoryRow[]): string {
  const outN = rows.filter((r) => r.out).length;
  return outN > 0
    ? `${outN} product${outN === 1 ? '' : 's'} out of stock (+${rows.length - outN} low)`
    : `${rows.length} product${rows.length === 1 ? '' : 's'} low on stock`;
}

function lowStockHtml(rows: InventoryRow[]): string {
  const li = rows
    .map((r) => `<li><strong>${escapeHtml(r.title)}</strong> — ${r.out ? 'out of stock' : `${r.onHand} left`}${r.sku ? ` (SKU ${escapeHtml(r.sku)})` : ''}</li>`)
    .join('');
  return `<p>The following items need restocking:</p><ul>${li}</ul><p>Manage stock in your Inventory dashboard.</p>`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
