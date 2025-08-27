// lib/normalizeImageSrc.ts
const imageCache: Record<string, string> = {};
const pending: Record<string, Promise<string>> = {};
const fallbackDefault = '/images/campaigns/tow-truck-logo.png';

function normalize(url: string) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return `/${url}`;
}

function checkImageViaTag(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(true); // defer real check to client
    const img = new Image();
    // don't set crossOrigin; many hosts lack ACAO. Keep it simple.
    img.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };
    img.onload = () => { cleanup(); resolve(true); };
    img.onerror = () => { cleanup(); resolve(false); };
    img.src = url;
  });
}

/** Resolve/cached image src, falling back if unreachable (no CORS issues). */
export async function normalizeImageSrc(
  src?: string,
  fallback: string = fallbackDefault
): Promise<string> {
  if (!src) return fallback;
  if (imageCache[src]) return imageCache[src];
  if (await pending[src]) return pending[src] as Promise<string>;

  const candidate = normalize(src);

  const p = (async () => {
    const ok = await checkImageViaTag(candidate);
    const result = ok ? candidate : fallback;
    imageCache[src] = result;
    delete pending[src];
    return result;
  })();

  pending[src] = p;
  return p;
}
