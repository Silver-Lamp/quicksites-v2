// /app/api/cron/weekly-compliance-digest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function ok(req: NextRequest) {
  return req.headers.get('x-cron-secret') === process.env.CRON_SECRET;
}

type CS = { overall: 'ok'|'warning'|'blocked'; missing?: string[]|null };
type Doc = { id: string; status: string; expires_at: string|null; };
type County = { state: string; county: string; active: boolean; created_at: string; updated_at: string; };

export async function POST(req: NextRequest) {
  if (!ok(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7 = new Date(today.getTime() - 7*24*3600e3);
  const plus31 = new Date(today.getTime() + 31*24*3600e3);

  // 1) Chefs OK vs blocked
  const { data: cs } = await svc
    .from('compliance_status')
    .select('overall, missing');

  const total = (cs?.length || 0);
  const blocked = (cs || []).filter(r => r.overall === 'blocked').length;
  const okCount = (cs || []).filter(r => r.overall === 'ok').length;

  // Top missing reasons (from blocked merchants)
  const freq: Record<string, number> = {};
  (cs || []).forEach(r => {
    if (r.overall !== 'blocked') return;
    (r.missing || []).forEach((code: string) => { freq[code] = (freq[code] || 0) + 1; });
  });
  const topMissing = Object.entries(freq)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([code, n]) => `${code}: ${n}`);

  // 2) Expiring items by stage
  const { data: docs } = await svc
    .from('compliance_docs')
    .select('id, status, expires_at')
    .not('expires_at', 'is', null);

  const bucket = { d30:0, d14:0, d7:0, d1:0, expired:0 };
  (docs || []).forEach((d: Doc) => {
    const exp = d.expires_at ? new Date(d.expires_at) : null;
    if (!exp) return;
    const days = Math.ceil((exp.getTime() - today.getTime()) / (24*3600e3));
    if (d.status === 'expired' || days < 0) bucket.expired++;
    else if (days === 30) bucket.d30++;
    else if (days === 14) bucket.d14++;
    else if (days === 7)  bucket.d7++;
    else if (days === 1)  bucket.d1++;
  });

  // 3) MEHKO county changes (last 7 days)
  const { data: counties } = await svc
    .from('mehko_opt_in_counties')
    .select('state, county, active, created_at, updated_at');

  const added = (counties || []).filter(c => new Date(c.created_at) >= last7);
  const toggled = (counties || []).filter(c =>
    new Date(c.updated_at) >= last7 && new Date(c.created_at) < last7
  );

  // Build Slack text
  const lines = [
    `*Weekly Compliance Digest*`,
    `• Chefs OK: *${okCount}*  |  Blocked: *${blocked}*  (Total: ${total})`,
    `• Blocked — top missing: ${topMissing.length ? topMissing.join(', ') : '—'}`,
    `• Expiring — 30d: *${bucket.d30}*, 14d: *${bucket.d14}*, 7d: *${bucket.d7}*, 1d: *${bucket.d1}*, expired: *${bucket.expired}*`,
    `• MEHKO county updates (7d):`,
    `   – Added: ${added.length ? added.map(c=>`${c.state}/${c.county}`).join(', ') : '—'}`,
    `   – Toggled: ${toggled.length ? toggled.map(c=>`${c.state}/${c.county} → ${c.active?'active':'inactive'}`).join('; ') : '—'}`
  ].join('\n');

  // Slack (optional)
  if (process.env.COMPLIANCE_SLACK_WEBHOOK_URL) {
    await fetch(process.env.COMPLIANCE_SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ text: lines })
    }).catch(()=>{});
  }

  // Email (optional): send to comma-separated OPS_EMAILS
  const emails = (process.env.OPS_EMAILS || '')
    .split(',').map(s=>s.trim()).filter(Boolean);

  if (emails.length) {
    const html = `
      <h3>Weekly Compliance Digest</h3>
      <ul>
        <li>Chefs OK: <b>${okCount}</b> | Blocked: <b>${blocked}</b> (Total: ${total})</li>
        <li>Blocked — top missing: ${topMissing.length ? topMissing.join(', ') : '—'}</li>
        <li>Expiring — 30d: <b>${bucket.d30}</b>, 14d: <b>${bucket.d14}</b>, 7d: <b>${bucket.d7}</b>, 1d: <b>${bucket.d1}</b>, expired: <b>${bucket.expired}</b></li>
        <li>MEHKO county updates (7d):
          <ul>
            <li>Added: ${added.length ? added.map(c=>`${c.state}/${c.county}`).join(', ') : '—'}</li>
            <li>Toggled: ${toggled.length ? toggled.map(c=>`${c.state}/${c.county} → ${c.active?'active':'inactive'}`).join('; ') : '—'}</li>
          </ul>
        </li>
      </ul>
    `;

    await Promise.all(emails.map(to =>
      svc.from('email_outbox').insert({
        to_email: to,
        subject: 'Weekly Compliance Digest',
        html
      })
    ));
  }

  return NextResponse.json({ ok: true });
}
