import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TwitterApi } from 'twitter-api-v2';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export const runtime = 'edge';

export async function GET() {
  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
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
