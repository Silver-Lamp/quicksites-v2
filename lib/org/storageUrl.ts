// lib/org/storageUrl.ts — a stored brand asset URL must not carry an expiry.
//
// ⚠️ Every org logo but one vanished on 2026-10-16 (homepage hero, the org switcher, the admin
// chrome): `uploadOrgAsset` preferred a ONE-YEAR signed URL even though the `logos` bucket is
// public, and that URL — token and all — was written into `organizations.logo_url`. CedarSites'
// token expired 2026-09-06, Point Seven's 2026-10-03, QuickSites' 2026-10-09; each logo turned into
// its alt text on the day, with no error anywhere. A signed URL is a credential with a clock; a
// brand field is forever. On a public bucket the two URL forms serve the same bytes, so the fix is
// the plain public form — and readers normalise defensively, because the rows are already out there.
export const PUBLIC_STORAGE_BUCKETS = ['logos', 'site-images', 'videos'] as const;

const SIGNED = /^(https?:\/\/[^/]+\/storage\/v1\/object)\/sign\/([^/?#]+)\/([^?#]+)(?:[?#].*)?$/;

/**
 * `…/object/sign/<bucket>/<path>?token=…` → `…/object/public/<bucket>/<path>` when the bucket is
 * public. Anything else (a public URL, a private-bucket signed URL, a non-storage URL, null) is
 * returned unchanged.
 */
export function publicStorageUrl<T extends string | null | undefined>(url: T, publicBuckets: readonly string[] = PUBLIC_STORAGE_BUCKETS): T {
  if (typeof url !== 'string') return url;
  const m = SIGNED.exec(url.trim());
  if (!m) return url;
  const [, base, bucket, path] = m;
  if (!publicBuckets.includes(bucket)) return url;
  return `${base}/public/${bucket}/${path}` as T;
}

/** True when the URL is a signed storage URL (any bucket) — i.e. it will stop working one day. */
export function isSignedStorageUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && SIGNED.test(url.trim());
}
