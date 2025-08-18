import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { getServerContext } from '@/lib/supabase/getServerContext';

export const runtime = 'nodejs';        // service role requires Node runtime
export const dynamic = 'force-dynamic'; // avoid caching surprises

async function assertAdmin() {
  // Uses getServerContext(): awaits cookies() and uses createServerClient under the hood
  const { supabase } = await getServerContext();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { code: 401 as const, error: 'Not signed in' };

  // Check your admin gate via DB table (kept from your original)
  const { data: adminRow, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { code: 500 as const, error: error.message };
  if (!adminRow) return { code: 403 as const, error: 'Forbidden' };

  return { code: 200 as const, user };
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) {
    return NextResponse.json({ error: gate.error }, { status: gate.code });
  }

  const { email, password, name } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: 'email and password required' },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing Supabase env vars' },
      { status: 500 }
    );
  }

  // Service role client (no cookies); disable session persistence
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });

  if (error) {
    const status = /already/i.test(error.message) ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, user: data.user });
}
