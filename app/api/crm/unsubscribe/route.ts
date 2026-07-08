// app/api/crm/unsubscribe/route.ts
//
// Public one-click unsubscribe for marketing emails (CAN-SPAM). The signed token in
// every campaign email binds a customer id; we verify it and flip marketing_consent
// to false. Idempotent, no auth (the token IS the authorization), GET so email
// clients' List-Unsubscribe + link clicks both work.
import { NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyUnsubToken } from '@/lib/crm/unsubToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(title: string, message: string, ok: boolean): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
    <div style="max-width:420px;padding:32px;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">${ok ? '✅' : '⚠️'}</div>
      <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
      <p style="color:#a3a3a3;line-height:1.5;margin:0">${message}</p>
    </div>
  </body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const v = verifyUnsubToken(token);
  if (!v) return page('Invalid link', 'This unsubscribe link is invalid or malformed.', false);

  // Cast: customers isn't in the generated types (CLAUDE.md §8).
  const svc = (await getServerSupabase({ serviceRole: true })) as any;
  const { error } = await svc.from('customers').update({ marketing_consent: false, updated_at: new Date().toISOString() }).eq('id', v.customerId);
  if (error) return page('Something went wrong', 'We could not process your request. Please try again later.', false);

  return page('Unsubscribed', 'You’ve been removed from marketing emails. You’ll still get transactional messages about your orders.', true);
}
