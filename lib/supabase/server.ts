import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';

type Context =
  | GetServerSidePropsContext
  | { req: NextApiRequest; res: NextApiResponse };

export function createSupabaseServerClient(
  context: Context
): SupabaseClient {
  return createPagesServerClient(context);
}
