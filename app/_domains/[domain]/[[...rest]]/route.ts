import { NextResponse, type NextRequest } from 'next/server';

function stripWww(host: string) {
  const h = (host || '').toLowerCase().replace(/\.$/, '');
  return h.startsWith('www.') ? h.slice(4) : h;
}

// naive but effective for your current domains
function slugFromDomain(domain: string) {
  const apex = stripWww(domain);
  const parts = apex.split('.');
  return parts[0] || apex; // "graftontowing"
}

export async function GET(
  req: NextRequest,
  { params }: { params: { domain: string; rest?: string[] } }
) {
  const slug = slugFromDomain(params.domain);
  const extra = params.rest?.length ? `/${params.rest.join('/')}` : '/home';
  const dest = new URL(`/sites/${slug}${extra}`, req.url);

  const res = NextResponse.rewrite(dest);
  res.headers.set('x-qsites-domain', params.domain);
  res.headers.set('x-qsites-resolved-slug', slug);
  res.headers.set('x-qsites-rewrite', dest.pathname + dest.search);
  return res;
}

export const dynamic = 'force-dynamic';
