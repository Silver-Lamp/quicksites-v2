// app/api/gsc/auth-url/route.ts
import { NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = 'http://localhost:3000/api/gsc/oauth-callback';

export async function GET() {
  const base = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.json({ url: `${base}?${params.toString()}` });
}
