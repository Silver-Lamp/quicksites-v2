// app/api/cron/print-order-sync/route.ts
//
// Poll in-flight POD print orders (Lulu/Gelato) and update their status.
// Gated by POD_ENABLED. Cron-authorized.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCron } from '@/lib/cron/record';
import { isCronAuthorized } from '@/lib/cron/auth';
import { isPodEnabled, isProviderConfigured, type PodProvider } from '@/lib/commerce/pod';
import * as lulu from '@/lib/commerce/pod/lulu';
import * as gelato from '@/lib/commerce/pod/gelato';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isTerminal(s?: string | null): boolean {
  return /ship|deliver|cancel|reject|error|fulfilled|refunded/i.test(s || '');
}

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return runCron('print-order-sync', async () => {
    if (!isPodEnabled()) return NextResponse.json({ ok: true, skipped: 'POD_ENABLED!=true' });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: rows } = await db
      .from('print_orders')
      .select('id, provider, provider_job_id, status')
      .not('provider_job_id', 'is', null)
      .limit(200);

    let updated = 0;
    for (const r of rows || []) {
      const provider = (r as any).provider as PodProvider;
      if (isTerminal((r as any).status) || !isProviderConfigured(provider)) continue;
      try {
        const status =
          provider === 'lulu'
            ? (await lulu.getPrintJob((r as any).provider_job_id)).status
            : (await gelato.getGelatoOrder((r as any).provider_job_id)).fulfillmentStatus || 'unknown';
        if (status && status !== (r as any).status) {
          await db.from('print_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', (r as any).id);
          updated++;
        }
      } catch {
        /* skip this row; retry next run */
      }
    }
    return NextResponse.json({ ok: true, checked: (rows || []).length, updated });
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
