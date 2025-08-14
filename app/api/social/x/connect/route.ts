import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'edge';

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.APP_BASE_URL!));

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  });

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    process.env.TWITTER_CALLBACK_URL!,
    { scope: ['tweet.read','tweet.write','users.read','offline.access'] }
  );

  // Store verifier/state in a cookie
  const res = NextResponse.redirect(url);
  res.cookies.set('x_oauth_state', state, { httpOnly: true, path: '/', maxAge: 600 });
  res.cookies.set('x_oauth_verifier', codeVerifier, { httpOnly: true, path: '/', maxAge: 600 });
  return res;
}
