import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export async function lookupTenantBySlug(slug: string): Promise<string | null> {
  // eslint-disable-next-line no-restricted-syntax
  const cookieStore = await cookies();

  const supabase = createServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Tenant lookup error:', error.message);
    return null;
  }

  return data?.id ?? null;
}
