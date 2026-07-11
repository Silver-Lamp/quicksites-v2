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
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}
