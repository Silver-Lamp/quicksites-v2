const imageCache: Record<string, string> = {}; // src → resolved or fallback
const fallbackDefault = '/logo-placeholder.png';

async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Normalizes an image src, validates it with a HEAD request, and caches the result.
 * Returns fallback if invalid or unreachable.
 */
export async function normalizeImageSrc(
  src?: string,
  fallback: string = fallbackDefault
): Promise<string> {
  if (!src) return fallback;

  if (imageCache[src]) return imageCache[src];

  let normalized: string;
  if (src.startsWith('//')) {
    normalized = 'https:' + src;
  } else if (src.startsWith('/') || src.startsWith('http')) {
    normalized = src;
  } else {
    normalized = '/' + src;
  }

  const isValid = await checkImageUrl(normalized);
  const result = isValid ? normalized : fallback;

  imageCache[src] = result;
  return result;
}
