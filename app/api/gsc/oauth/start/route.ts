import { NextResponse } from 'next/server';

const redirectUri = 'https://quicksites.ai/api/gsc/oauth/callback';
const scope = 'https://www.googleapis.com/auth/webmasters.readonly';

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GSC_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
