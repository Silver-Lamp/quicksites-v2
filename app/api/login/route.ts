// app/api/login/route.ts
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const email = normalizeEmail(body.email || '');
  const requestedNext = body.next || '/admin/tools';
  const next = typeof requestedNext === 'string' && requestedNext.startsWith('/') ? requestedNext : '/admin/tools';

  if (!isValid(email)) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const origin = getOrigin(req);

  // Absolute or relative override is allowed (e.g., '/auth/callback' or full URL)
  const override = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || '/auth/callback';
  const u = new URL(override, override.startsWith('http') ? undefined : origin);
  u.searchParams.set('next', next);
  const redirect = u.toString();

  const supabase = createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirect },
  });

  return NextResponse.json({ ok: !error, origin, redirect, error: error?.message ?? null }, { status: error ? 400 : 200 });
}

// Optional hard-disable GET to avoid confusion
export function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}
