// app/api/seo-coach/unsubscribe/route.ts
//
// Public one-click unsubscribe for AI SEO Coaching emails. The signed token binds a
// user id; we verify it and flip the email_preferences opt-out. `?kind=daily|weekly`
// unsubscribes just that stream; otherwise both. Idempotent, no auth (the token IS the
// authorization), GET so email clients' List-Unsubscribe + link clicks both work.
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCoachUnsubToken } from '@/lib/seo/coach/unsubToken';
import { captureServer } from '@/lib/analytics/posthog-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

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

async function unsubscribe(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const kind = req.nextUrl.searchParams.get('kind'); // 'daily' | 'weekly' | null (both)
  const v = verifyCoachUnsubToken(token);
  if (!v) return page('Invalid link', 'This unsubscribe link is invalid or malformed.', false);

  const patch: Record<string, unknown> = { user_id: v.userId, updated_at: new Date().toISOString() };
  if (kind === 'daily') patch.seo_coach_daily = false;
  else if (kind === 'weekly') patch.seo_coach_weekly = false;
  else {
    patch.seo_coach_daily = false;
    patch.seo_coach_weekly = false;
    patch.unsubscribed_all = true;
  }

  const { error } = await (admin as any).from('email_preferences').upsert(patch, { onConflict: 'user_id' });
  if (error) return page('Something went wrong', 'We could not process your request. Please try again later.', false);

  await captureServer('seo_coach_unsubscribed', { user_id: v.userId, kind: kind ?? 'all' }, v.userId).catch(() => {});

  return page(
    'Unsubscribed',
    kind
      ? `You’ve been removed from the ${kind} SEO coaching email. You can re-enable it anytime in your profile settings.`
      : 'You’ve been removed from SEO coaching emails. You can re-enable them anytime in your profile settings.',
    true,
  );
}

export const GET = unsubscribe;
export const POST = unsubscribe; // List-Unsubscribe-Post one-click
