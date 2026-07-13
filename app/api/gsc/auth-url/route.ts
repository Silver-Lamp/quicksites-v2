// app/api/gsc/auth-url/route.ts
import { NextResponse } from 'next/server';
import { gscClientId, gscRedirectUri } from '@/lib/gsc/oauthConfig';

export async function GET() {
  const clientId = gscClientId();
  if (!clientId) {
    // Fail loudly instead of building a URL with client_id=undefined.
    return NextResponse.json(
      { error: 'Google Search Console is not configured (missing GOOGLE_CLIENT_ID / GSC_CLIENT_ID).' },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gscRedirectUri(),
    response_type: 'code',
    // webmasters (read-WRITE, so we can programmatically add geo-domains as properties) +
    // siteverification (so we can DNS-TXT-verify them). Superset of the old readonly scope,
    // so reads keep working — but existing connections must RE-CONSENT once to grant write.
    scope: [
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/siteverification',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}
