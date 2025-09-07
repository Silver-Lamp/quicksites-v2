// lib/org/resolveOrg.ts
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export type Org = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  dark_logo_url: string | null;
  favicon_url: string | null;
  theme_json: any;
  support_email: string | null;
  support_url: string | null;
  billing_mode: 'central' | 'reseller' | 'none' | null;
};

const DEFAULT_FALLBACK: Org = {
  id: '00000000-0000-0000-0000-000000000000',
  slug: 'default',
  name: 'QuickSites',
  logo_url: null,
  dark_logo_url: null,
  favicon_url: null,
  theme_json: {},
  support_email: null,
  support_url: null,
  billing_mode: 'central',
};

export async function resolveOrg(): Promise<Org> {
  // ⬇️ Next 15: must await
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase();

  const store = await cookies();
  const supa = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => store.get(n)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  // 1) dev override cookie (?org=cedarsites via middleware)
  const cookieOrg = store.get('qs_org_slug')?.value?.toLowerCase();
  if (cookieOrg) {
    const { data } = await supa
      .from('organizations_public')
      .select('*')
      .eq('slug', cookieOrg)
      .maybeSingle();
    if (data) return normalize(data);
  }

  // 2) host mapping via public view (optional)
  const { data: dom } = await supa
    .from('org_domains_public')
    .select('org_id, organizations_public:org_id(*)')
    .eq('host', host)
    .maybeSingle();

  if (dom && (dom as any).organizations_public) {
    return normalize((dom as any).organizations_public);
  }

  // 3) fallback to env/default slug (non-crashing)
  const fallbackSlug = (process.env.DEFAULT_ORG_SLUG || 'quicksites').toLowerCase();
  const { data: fb } = await supa
    .from('organizations_public')
    .select('*')
    .eq('slug', fallbackSlug)
    .maybeSingle();
  if (fb) return normalize(fb);

  return DEFAULT_FALLBACK;
}

function normalize(row: any): Org {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    logo_url: row.logo_url ?? null,
    dark_logo_url: row.dark_logo_url ?? null,
    favicon_url: row.favicon_url ?? null,
    theme_json: row.theme_json ?? {},
    support_email: row.support_email ?? null,
    support_url: row.support_url ?? null,
    billing_mode: (row.billing_mode ?? 'central') as Org['billing_mode'],
  };
}
