// app/_domains/[domain]/[[...path]]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function stripWww(host: string) {
  const h = (host || '').toLowerCase().replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

type SiteRow = {
  slug?: string | null;
  is_published?: boolean | null;
  published_snapshot_id?: string | null;
};

type TemplateRow = {
  slug?: string | null;
  is_site?: boolean | null;
};

async function resolveSlugForDomain(hostname: string) {
  const sb = await getServerSupabase();

  const host = hostname.toLowerCase().replace(/\.$/, '');
  const apex = stripWww(host);
  const withWww = apex === host ? `www.${apex}` : host;
  const candidates = Array.from(new Set([host, apex, withWww]));

  // 1) Prefer SITES (new SoT)
  {
    const { data, error } = await sb
      .from('sites')
      .select('slug,is_published,published_snapshot_id')
      .in('domain', candidates)
      .limit(1);

    if (!error && data && data.length) {
      const row = data[0] as SiteRow;
      if (row.slug) return row.slug;
      // If you want to enforce "published-only", uncomment:
      // if (!(row.is_published || row.published_snapshot_id)) return null;
    }
  }

  // 2) Legacy fallback: TEMPLATES (domain_lc → custom_domain → domain)
  for (const col of ['domain_lc', 'custom_domain', 'domain'] as const) {
    const { data, error } = await sb
      .from('templates')
      .select('slug,is_site')
      .in(col, candidates)
      .order('is_site', { ascending: false })
      .limit(1);

    if (!error && data && data.length) {
      const row = data[0] as TemplateRow;
      if (row.slug) return row.slug;
    }
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { domain: string; path?: string[] } }
) {
  const slug = await resolveSlugForDomain(params.domain);
  if (!slug) return NextResponse.rewrite(new URL('/_not-found', req.url));

  // ✅ If root, send to default page "home"
  const extra = params.path?.length ? `/${params.path.join('/')}` : '/home';

  const dest = new URL(`/sites/${slug}${extra}`, req.url);
  const res = NextResponse.rewrite(dest);
  res.headers.set('x-qsites-resolved-slug', slug);
  res.headers.set('x-qsites-rewrite', dest.pathname + dest.search);
  return res;
}

export const dynamic = 'force-dynamic';
