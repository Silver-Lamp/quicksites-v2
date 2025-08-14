import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Protect this route with a secret header from your scheduler.
function authorize(req: NextRequest) {
  return req.headers.get('x-cron-secret') === process.env.CRON_SECRET;
}

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DocRow = {
  id: string;
  merchant_id: string;
  requirement_id: string;
  expires_at: string | null;
  merchants: { user_id: string | null; display_name: string | null; name: string | null } | null;
  compliance_requirements: { code: string; details: any } | null;
};

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date();
  today.setHours(0,0,0,0);

  // 1) Auto-expire any past-due docs (optional; if you already run a DB function nightly, skip)
  await svc.from('compliance_docs')
    .update({ status: 'expired' })
    .lt('expires_at', today.toISOString().slice(0,10))
    .eq('status','approved');

  // 2) Fetch expiring in the next 31 days and already expired (for stage 0 notice)
  const { data: rows, error } = await svc
    .from('compliance_docs')
    .select('id, merchant_id, requirement_id, expires_at, status, merchants(user_id, display_name, name), compliance_requirements(code, details)')
    .in('status', ['approved','expired'])
    .not('expires_at', 'is', null)
    .lte('expires_at', new Date(today.getTime() + 31*24*3600e3).toISOString().slice(0,10));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3) Group by merchant, compute stage per doc
  const stageDays = new Set([30,14,7,1]);
  const byMerchant = new Map<string, Array<{row: DocRow, stage: number}>>();

  for (const r of (rows || []) as any as DocRow[]) {
    const exp = r.expires_at ? new Date(r.expires_at) : null;
    let stage = -1;
    if (!exp) continue;
    const days = Math.ceil((exp.getTime() - today.getTime()) / (24*3600e3));
    if ((r as any).status === 'expired' || days < 0) stage = 0;
    else if (stageDays.has(days)) stage = days;
    else continue;

    const list = byMerchant.get(r.merchant_id) || [];
    list.push({ row: r, stage });
    byMerchant.set(r.merchant_id, list);
  }

  // 4) For each merchant, filter out docs already notified at this stage; send one email
  let sentCount = 0;

  for (const [merchantId, items] of byMerchant.entries()) {
    // filter by unsent per doc+stage
    const candidates: Array<{row: DocRow, stage:number}> = [];
    for (const it of items) {
      const { data: seen } = await svc
        .from('compliance_notifications')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('doc_id', it.row.id)
        .eq('stage', it.stage)
        .maybeSingle();
      if (!seen) candidates.push(it);
    }
    if (!candidates.length) continue;

    // get contact email
    const any = candidates[0].row;
    const ownerId = any.merchants?.user_id || null;
    let toEmail: string | null = null;
    if (ownerId) {
      const { data: u } = await svc.auth.admin.getUserById(ownerId);
      toEmail = u?.user?.email || null;
    }
    // If no user email, skip gracefully
    if (!toEmail) continue;

    // Build email body
    const chef = any.merchants?.display_name || any.merchants?.name || 'Chef';
    const lines = candidates.map(({ row, stage }) => {
      const label = row.compliance_requirements?.details?.label || row.compliance_requirements?.code || 'Requirement';
      const date = row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '—';
      const tag = stage === 0 ? 'Expired' : `Expires in ${stage} day${stage === 1 ? '' : 's'}`;
      return `<li><b>${label}</b> — ${tag} (on ${date})</li>`;
    }).join('');

    const html =
      `<p>Hi ${chef},</p>
       <p>The following compliance items need attention:</p>
       <ul>${lines}</ul>
       <p><a href="${process.env.APP_BASE_URL}/chef/compliance" style="display:inline-block;padding:10px 16px;border:1px solid #111;border-radius:8px;color:#111;text-decoration:none">Open compliance</a></p>
       <p style="color:#666;font-size:12px;">You’re receiving this because you have items approaching expiration. We remind at 30/14/7/1 days and at expiration.</p>`;

    await svc.from('email_outbox').insert({
      to_user_id: ownerId,
      to_email: toEmail,
      subject: 'Action needed: Compliance item(s) expiring',
      html
    });

    // Record sends (per item)
    const inserts = candidates.map(c => ({
      merchant_id: merchantId, doc_id: c.row.id, stage: c.stage
    }));
    await svc.from('compliance_notifications').upsert(inserts, { onConflict: 'merchant_id,doc_id,stage' });

    // Recompute compliance snapshot after expirations (optional)
    try {
      await svc.rpc('compliance_recompute_status', { p_merchant_id: merchantId })
    } catch (e) {
      console.error(e);
    }

    sentCount++;
  }

  return NextResponse.json({ ok: true, sent: sentCount });
}
