import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { createServerClient } from '@supabase/ssr';
import { cookies as nextCookies } from 'next/headers';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';

type PagesContext =
  | GetServerSidePropsContext
  | { req: NextApiRequest; res: NextApiResponse };

export function createSupabaseServerClient(context: PagesContext): SupabaseClient {
  return createPagesServerClient(context);
}

export async function createAppSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await nextCookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}
