// app/favicon.ico/route.ts
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // Proxy the static icon (must exist at public/qs-default-favicon.ico)
  const url = new URL(req.url);
  const target = new URL('/qs-default-favicon.ico', url);

  // Fetch the static asset and stream it through
  const res = await fetch(target.toString(), { cache: 'force-cache' });
  if (!res.ok || !res.body) {
    return new Response('favicon not found', { status: 404 });
  }

  const headers = new Headers(res.headers);
  // Ensure correct type + sensible caching
  headers.set('Content-Type', 'image/x-icon');
  headers.set('Cache-Control', 'public, max-age=86400, immutable');

  return new Response(res.body, { status: 200, headers });
}
