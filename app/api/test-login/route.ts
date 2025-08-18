// app/api/test-login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(raw: string) {
  return raw.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
}
const isValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Disabled in prod' }, { status: 404 });
  }
  const url = new URL(req.url);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const email = normalizeEmail(url.searchParams.get('email') || 'sandon@pointsevenstudio.com');
  if (!isValid(email)) return NextResponse.json({ ok: false, error: 'Invalid email (client check)' }, { status: 400 });

  const redirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || `${url.origin}/auth/callback`;
  const supabase = createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });

  return NextResponse.json({ ok: !error, email, redirect, error: error?.message ?? null }, { status: error ? 400 : 200 });
}
