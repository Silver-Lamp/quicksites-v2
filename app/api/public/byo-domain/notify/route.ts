// app/api/public/byo-domain/notify/route.ts
//
// "Bring your own domain" final step: tell the operators a real domain owner just
// built a starter and wants their domain pointed here — the human follow-up ("attach
// the domain when they publish") is the operator's job today. Public (guest flow) but
// safe: rate-limited, no privileged writes — it only emails ADMIN_EMAILS, and only
// after verifying the template exists AND was stamped with this intended_domain by
// the create step (so it can't be used to spray arbitrary content at the admins).
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { normalizeApex } from '@/lib/domains/util';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'byo-domain-notify', 5, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, template_name, slug, data')
    .eq('id', templateId)
    .maybeSingle();
  const intended = (t as any)?.data?.meta?.intended_domain;
  if (!t || typeof intended !== 'string' || !intended) {
    return NextResponse.json({ error: 'not_a_byo_draft' }, { status: 400 });
  }
  let domain: string;
  try {
    domain = normalizeApex(intended);
  } catch {
    return NextResponse.json({ error: 'not_a_byo_draft' }, { status: 400 });
  }

  const admins = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let notified = false;
  if (admins.length) {
    const base = (process.env.APP_BASE_URL || 'https://quicksites.ai').replace(/\/+$/, '');
    try {
      await sendEmail({
        to: admins,
        subject: `BYO domain: ${domain} wants to point here`,
        html: [
          `<p>Someone brought their own domain through <b>/bring-your-domain</b>:</p>`,
          `<p><b>${domain}</b> → starter draft “${(t as any).template_name ?? (t as any).slug ?? t.id}”</p>`,
          `<p><a href="${base}/admin/templates/${t.id}">Open the draft in the editor</a></p>`,
          `<p>They got the DNS records (A @ + CNAME www, MX untouched). When they sign up and publish, attach the domain from the editor's domain panel.</p>`,
        ].join('\n'),
      });
      notified = true;
    } catch {
      notified = false;
    }
  }
  return NextResponse.json({ ok: true, notified });
}
