// app/api/auth/providers/route.ts
//
// Public: which sign-in methods are live. Read by client components that cannot await the
// server helper (the guest sign-up box inside the editor). Nothing here is secret — it is the
// same information Supabase's own public settings endpoint returns — and the answer is cached
// at the edge so a page full of visitors costs one upstream read per five minutes.
import { NextResponse } from 'next/server';
import { getEnabledAuthProviders, PROVIDERS_REVALIDATE_SECONDS } from '@/lib/auth/authProviders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = await getEnabledAuthProviders();
  return NextResponse.json(providers, {
    headers: {
      'cache-control': `public, s-maxage=${PROVIDERS_REVALIDATE_SECONDS}, stale-while-revalidate=${PROVIDERS_REVALIDATE_SECONDS * 2}`,
    },
  });
}
