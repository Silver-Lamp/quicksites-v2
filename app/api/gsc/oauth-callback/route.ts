// app/api/gsc/oauth-callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { gscClientId, gscClientSecret, gscBaseUrl, gscRedirectUri } from '@/lib/gsc/oauthConfig';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

// Shared with /api/gsc/auth-url — the client id + redirect URI MUST match.
const GOOGLE_CLIENT_ID = gscClientId();
const GOOGLE_CLIENT_SECRET = gscClientSecret();
const BASE_URL = gscBaseUrl();
const REDIRECT_URI = gscRedirectUri();

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

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  // ⚠️ A GRANT FROM AN ACCOUNT WITH NO PROPERTIES IS STILL THE GRANT THE BACKFILL NEEDS. This used
  // to answer `{"error":"No verified sites found"}` and drop the token on the floor — after the
  // operator had approved both scopes. But the nightly gsc-backfill exists precisely to ADD
  // properties (verify by DNS TXT, then add), which any account can do; it only needs a refresh
  // token with the write scopes under the operator's user id (connectDomain.ts picks the newest).
  // So the grant is stored either way: per property when there are some, under a sentinel row
  // when there are none. The one thing a zero-property grant cannot do is refresh the existing
  // per-property rows, which belong to whichever account owns those properties.
  const grantOwner = userId ?? (await firstOperatorId());
  if (siteEntries.length === 0) {
    if (grantOwner) {
      await supabaseAdmin.from('gsc_tokens').upsert(
        {
          domain: `account-grant:${grantOwner}`,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expiry: expiresAt,
          user_id: grantOwner,
        },
        { onConflict: 'domain' }
      );
    }
    return NextResponse.redirect(`${BASE_URL}/admin/templates/gsc-bulk-stats?connected=1&sites=0`);
  }

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
          user_id: grantOwner,
        },
        { onConflict: 'domain' }
      );
    }
  }

  return NextResponse.redirect(`${BASE_URL}/admin/templates/gsc-bulk-stats?connected=1&sites=${siteEntries.length}`);
}

/**
 * The consent may arrive without a QuickSites session cookie (a different browser profile, an
 * incognito window). A token row with user_id null is invisible to the backfill, which looks the
 * operator up by user_id — so fall back to the first platform operator rather than store nothing.
 */
async function firstOperatorId(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('admin_users').select('user_id').order('created_at', { ascending: true }).limit(1).maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}
