import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('x_oauth_state')?.value || '';
  const verifier = cookieStore.get('x_oauth_verifier')?.value || '';
  if (!code || !verifier || !state || state !== stateCookie) {
    return new NextResponse('Invalid OAuth state', { status: 400 });
  }

  const client = new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  });

  const { client: logged, accessToken, refreshToken, expiresIn } =
    await client.loginWithOAuth2({ code, codeVerifier: verifier, redirectUri: process.env.TWITTER_CALLBACK_URL! });

  const me = await logged.v2.me();

  const supa = createRouteHandlerClient({ cookies: () => Promise.resolve(cookieStore) });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.APP_BASE_URL!));

  const { data: merchant } = await supa.from('merchants').select('id').eq('user_id', user.id).maybeSingle();
  if (!merchant) return NextResponse.redirect(new URL('/chef/dashboard?social=error', process.env.APP_BASE_URL!));

  await supa.from('social_accounts').upsert({
    merchant_id: merchant.id,
    provider: 'x',
    user_handle: me.data.username,
    access_token: accessToken,
    refresh_token: refreshToken || null,
    expires_at: expiresIn ? new Date(Date.now() + (expiresIn - 60) * 1000).toISOString() : null
  }, { onConflict: 'merchant_id,provider' });

  return NextResponse.redirect(new URL('/chef/dashboard?social=connected', process.env.APP_BASE_URL!));
}
