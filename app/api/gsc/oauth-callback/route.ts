// app/api/gsc/oauth-callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Dynamically detect correct redirect URI
const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://www.quicksites.ai'
    : 'http://localhost:3000';

const REDIRECT_URI = `${BASE_URL}/api/gsc/oauth-callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  // Auth session
  const cookieStore = await cookies();
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key: any) => cookieStore.get(key)?.value } }
  );
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const userId = session?.user?.id ?? null;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.json({ error: 'Token exchange failed', detail: tokens }, { status: 500 });
  }

  // Get all site entries for this user
  const siteRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const siteJson = await siteRes.json();
  const siteEntries = siteJson?.siteEntry ?? [];

  if (siteEntries.length === 0) {
    return NextResponse.json({ error: 'No verified sites found' }, { status: 404 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  // Insert a token row for each valid site
  for (const entry of siteEntries) {
    const domain = entry.siteUrl;
    const permission = entry.permissionLevel;

    if (permission === 'siteOwner' || permission === 'siteFullUser') {
      await supabaseAdmin.from('gsc_tokens').upsert(
        {
          domain,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expiry: expiresAt,
          user_id: userId,
        },
        { onConflict: 'domain' }
      );
    }
  }

  return NextResponse.redirect(`${BASE_URL}/admin/templates/gsc-bulk-stats?connected=1`);
}
