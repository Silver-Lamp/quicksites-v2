// ✅ route.ts
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // using anon key for auth
);

const enforceRateLimit = false;
const enforceRecaptcha = false; // ✅ off by default for local dev
const RATE_LIMIT_MINUTES = 5;

export async function POST(req: NextRequest) {
  const { email, recaptchaToken } = await req.json();

  if (!email || !recaptchaToken) {
    return Response.json({ error: 'Missing email or reCAPTCHA token' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  // 🚫 Rate limiting
  if (enforceRateLimit) {
    const { data: recent } = await supabase
      .from('session_logs')
      .select('timestamp')
      .eq('email', email)
      .eq('type', 'login_sent')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.timestamp) {
      const lastSent = new Date(recent.timestamp);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSent.getTime()) / 60000;
      if (diffMinutes < RATE_LIMIT_MINUTES) {
        return Response.json(
          {
            error: `Please wait ${Math.ceil(RATE_LIMIT_MINUTES - diffMinutes)} min before retrying.`,
          },
          { status: 429 }
        );
      }
    }
  }

  // 🔐 Optional reCAPTCHA check
  if (enforceRecaptcha) {
    console.log('[🔍 reCAPTCHA validation starting]', { recaptchaToken });
    try {
      const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: process.env.RECAPTCHA_SECRET_KEY!,
          response: recaptchaToken,
        }),
      });

      const result = await recaptchaRes.json();
      console.log('[✅ reCAPTCHA result]', result);

      if (!result.success || result.score < 0.5) {
        await supabase.from('session_logs').insert({
          type: 'recaptcha_fail',
          email,
          score: result.score,
          raw: result,
          ip,
          user_agent: userAgent,
          timestamp: new Date().toISOString(),
        });
        return Response.json({ error: 'Failed reCAPTCHA verification' }, { status: 403 });
      }
    } catch (err) {
      console.error('[❌ reCAPTCHA fetch failed]', err);
      return Response.json({ error: 'reCAPTCHA network error' }, { status: 500 });
    }
  }

  // ✅ Send OTP magic link
  try {
    console.log('[🔐 Sending Magic Link]', {
      email,
      redirect: `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });

    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
      },
    });

    console.log('[📤 Supabase OTP Response]', { data, error });

    await supabase.from('session_logs').insert({
      type: error ? 'login_failed' : 'login_sent',
      email,
      ip,
      user_agent: userAgent,
      token_start: recaptchaToken?.slice(0, 4) || '',
      token_end: recaptchaToken?.slice(-4) || '',
      timestamp: new Date().toISOString(),
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[❌ Unexpected Login Error]', err);
    return Response.json({ error: 'Unexpected error sending login link' }, { status: 500 });
  }
}
