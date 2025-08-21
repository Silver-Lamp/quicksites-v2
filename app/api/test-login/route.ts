import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(raw: string) {
  return raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
}
const isValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Derive the correct origin from headers (works on localhost, www, and Vercel previews)
function getOrigin(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in prod' }, { status: 404 });
  }

  const url = new URL(req.url);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = normalizeEmail(url.searchParams.get('email') || 'sandon@pointsevenstudio.com');
  if (!isValid(email)) return NextResponse.json({ ok: false, error: 'Invalid email (client check)' }, { status: 400 });

  // Preserve ?next= or legacy ?redirectTo=
  const requestedNext = url.searchParams.get('next') || url.searchParams.get('redirectTo') || '/admin/tools';
  const safeNext = requestedNext.startsWith('/') ? requestedNext : '/admin/tools';

  // Build redirect from the request’s actual origin unless an explicit override is set
  const origin = getOrigin(req);
  const fallback = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const redirect =
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL && process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL.startsWith('http')
      ? `${process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL}?next=${encodeURIComponent(safeNext)}`
      : fallback;

  const supabase = createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  });

  return NextResponse.json(
    { ok: !error, email, origin, redirect, error: error?.message ?? null },
    { status: error ? 400 : 200 }
  );
}
