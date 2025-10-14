// app/favicon.ico/route.ts
export const runtime = 'nodejs';

// Map host -> favicon path (under /public)
const CUSTOMS = new Map<string, string>([
  ['pnw-exteriorcleaning.com',        '/favicons/pnw-exterior-favicon.ico'],
  ['www.pnw-exteriorcleaning.com',    '/favicons/pnw-exterior-favicon.ico'],
  // preview/stage hosts (add/remove as needed)
  ['pnw-exteriorcleaning.quicksites.ai', '/favicons/pnw-exterior-favicon.ico'],
  // ['pnw-exteriorcleaning.vercel.app', '/favicons/pnw-exterior-favicon.ico'],
]);

const DEFAULT_ICON = '/qs-default-favicon.ico'; // must exist under /public

function resolveHost(req: Request) {
  // Prefer forwarded host (behind proxies), else use URL hostname
  const xfHost = req.headers.get('x-forwarded-host');
  if (xfHost && xfHost.trim().length > 0) return xfHost.toLowerCase();
  try {
    return new URL(req.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

async function fetchIcon(path: string, base: URL) {
  const url = new URL(path, base);
  return fetch(url.toString(), { cache: 'force-cache' });
}

function withIcoHeaders(res: Response) {
  const headers = new Headers(res.headers);
  headers.set('Content-Type', 'image/x-icon');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1y, safe for versioned files
  return headers;
}

export async function GET(req: Request) {
  const base = new URL(req.url);
  const host = resolveHost(req);
  const customPath = CUSTOMS.get(host) ?? DEFAULT_ICON;

  // Try custom; on failure, fall back to default
  let res = await fetchIcon(customPath, base);
  if ((!res.ok || !res.body) && customPath !== DEFAULT_ICON) {
    res = await fetchIcon(DEFAULT_ICON, base);
  }
  if (!res.ok || !res.body) {
    return new Response('favicon not found', { status: 404 });
  }

  return new Response(res.body, { status: 200, headers: withIcoHeaders(res) });
}

// Nice-to-have: support HEAD requests too
export async function HEAD(req: Request) {
  const r = await GET(req);
  // Return same headers/status without a body
  return new Response(null, { status: r.status, headers: r.headers });
}
