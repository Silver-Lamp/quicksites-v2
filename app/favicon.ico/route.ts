// app/favicon.ico/route.ts
import { NextResponse } from 'next/server';
import { getSiteByDomain } from '@/lib/templates/getSiteByDomain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const host = url.host; // e.g., graftontowing.com or subdomain
    const tpl = await getSiteByDomain(host);
    const icon = (tpl as any)?.data?.meta?.favicon_url as string | undefined;

    if (icon && /^https?:\/\//.test(icon)) {
      const res = NextResponse.redirect(icon, 302); // temporary so changes take effect immediately
      res.headers.set('Cache-Control', 'no-store, must-revalidate');
      return res;
    }

    // fallback to a renamed default icon in /public
    return NextResponse.rewrite(new URL('/qs-default-favicon.ico', url));
  } catch {
    return NextResponse.rewrite(new URL('/qs-default-favicon.ico', req.url));
  }
}
