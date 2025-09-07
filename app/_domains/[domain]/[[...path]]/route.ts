// app/_domains/[domain]/[[...path]]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

function stripWww(host: string) {
  const h = (host || '').toLowerCase().replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

async function resolveSlugForDomain(hostname: string) {
  // getServerSupabase returns a Promise<SupabaseClient>, so await it
  const sb = await getServerSupabase();

  const host = hostname.toLowerCase().replace(/\.$/, '');
  const apex = stripWww(host);
  const withWww = apex === host ? `www.${apex}` : host;
  const candidates = [host, apex, withWww];

  // 1) New source of truth: sites
  {
    const { data, error } = await sb
      .from('sites')
      .select('slug, is_published, published_snapshot_id')
      .in('domain', candidates)
      .maybeSingle();

    if (!error && data?.slug) {
      // Enforce published-only if you want:
      // if (!data.is_published && !data.published_snapshot_id) return null;
      return data.slug as string;
    }
  }

  // 2) Legacy fallback: templates (domain/custom_domain/domain_lc)
  {
    const inList = `("${candidates.join('","')}")`;
    const orFilter = [
      `domain.in.${inList}`,
      `custom_domain.in.${inList}`,
      `domain_lc.in.${inList}`,
    ].join(',');

    const { data, error } = await sb
      .from('templates')
      .select('slug, is_site')
      .or(orFilter)
      .order('is_site', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.slug) return data.slug as string;
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { domain: string; path?: string[] } }
) {
  const slug = await resolveSlugForDomain(params.domain);
  if (!slug) return NextResponse.rewrite(new URL('/_not-found', req.url));

  const extra = params.path?.length ? `/${params.path.join('/')}` : '';
  const dest = new URL(`/sites/${slug}${extra}`, req.url);

  const res = NextResponse.rewrite(dest);
  res.headers.set('x-qsites-resolved-slug', slug);
  res.headers.set('x-qsites-rewrite', dest.pathname + dest.search);
  return res;
}

export const dynamic = 'force-dynamic';
