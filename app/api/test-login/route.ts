// app/api/test-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const normalizeEmail = (raw: string) =>
  raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();

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
  const email = normalizeEmail(url.searchParams.get('email') || 'sandon@pointsevenstudio.com');
  if (!isValid(email)) return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });

  // Preserve ?next=/... (safe-guarded)
  const requestedNext = url.searchParams.get('next') || url.searchParams.get('redirectTo') || '/admin/templates/list';
  const safeNext = requestedNext.startsWith('/') ? requestedNext : '/admin/templates/list';

  const origin = getOrigin(req);
  const override = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL; // optional absolute OR relative (e.g. '/auth/callback')

  // Build an absolute redirect URL and append next=...
  const base = override && override.length > 0 ? override : '/auth/callback';
  const u = new URL(base, base.startsWith('http') ? undefined : origin);
  u.searchParams.set('next', safeNext);
  const redirect = u.toString();

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  });

  return NextResponse.json(
    { ok: !error, email, origin, redirect, error: error?.message ?? null },
    { status: error ? 400 : 200 },
  );
}
