import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment (safe on server)
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'QuickSites <sandon@contact.quicksites.ai>';
const EMAIL_SALES = process.env.EMAIL_SALES || 'support@quicksites.ai';
const EMAIL_SUPPORT = process.env.EMAIL_SUPPORT || 'support@quicksites.ai';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Minimal validation helpers
function isEmail(x: unknown): x is string {
  return typeof x === 'string' && /.+@.+\..+/.test(x);
}
function asBool(x: unknown, d = false) {
  return typeof x === 'boolean' ? x : d;
}
function asInt(x: unknown, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
}

export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name: string = (payload?.name || '').toString().trim();
  const email: string = (payload?.email || '').toString().trim();
  const company: string = (payload?.company || '').toString().trim();
  const sites: number = asInt(payload?.sites, 0);
  const message: string = (payload?.message || '').toString().trim();
  const migrating: boolean = asBool(payload?.migrating, false);
  const wantFounder: boolean = asBool(payload?.wantFounder, true);
  const includeAI: boolean = asBool(payload?.includeAI, false);

  if (!name || !isEmail(email) || !message) {
    return NextResponse.json({ error: 'Missing required fields: name, valid email, message.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const ua = req.headers.get('user-agent') || '';

  // 1) Log to Supabase (server role bypasses RLS)
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await supabase.from('contact_messages').insert({
        name,
        email,
        company: company || null,
        sites,
        message,
        migrating,
        want_founder: wantFounder,
        include_ai: includeAI,
        ip: ip || null,
        user_agent: ua || null,
      });
    } catch (e) {
      console.error('[contact] supabase insert failed', e);
      // non-fatal — continue to email
    }
  }

  // 2) Send notification email via Resend (if configured)
  if (RESEND_API_KEY) {
    try {
      const resend = new Resend(RESEND_API_KEY);
      const subject = `QuickSites contact: ${name} (${email})`;
      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; line-height:1.5;">
          <h2>New Contact</h2>
          <table style="border-collapse:collapse; width:100%;">
            <tbody>
              <tr><td style="padding:4px 0; width:140px; color:#666;">Name</td><td>${escapeHtml(name)}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">Email</td><td>${escapeHtml(email)}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">Company</td><td>${escapeHtml(company)}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">Sites</td><td>${sites}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">Migrating</td><td>${migrating ? 'Yes' : 'No'}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">Founder pricing</td><td>${wantFounder ? 'Yes' : 'No'}</td></tr>
              <tr><td style="padding:4px 0; color:#666;">AI Assist Pack</td><td>${includeAI ? 'Interested' : 'Not now'}</td></tr>
            </tbody>
          </table>
          <hr style="margin:16px 0; border:0; border-top:1px solid #eee;" />
          <div style="white-space:pre-wrap;">${escapeHtml(message)}</div>
          <hr style="margin:16px 0; border:0; border-top:1px solid #eee;" />
          <div style="font-size:12px; color:#777;">
            IP: ${escapeHtml(ip)}<br/>
            UA: ${escapeHtml(ua)}
          </div>
        </div>`;
      const text = `New contact\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\nSites: ${sites}\nMigrating: ${migrating}\nFounder: ${wantFounder}\nAI: ${includeAI}\n\nMessage:\n${message}\n\nIP: ${ip}\nUA: ${ua}`;

      await resend.emails.send({
        from: EMAIL_FROM,
        to: [EMAIL_SALES],
        bcc: EMAIL_SUPPORT ? [EMAIL_SUPPORT] : undefined,
        subject,
        html,
        text,
      });
    } catch (e) {
      console.error('[contact] resend email failed', e);
      // non-fatal — still return OK so the UI shows success
    }
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(str: string) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
