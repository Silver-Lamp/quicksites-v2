// lib/rateLimit.ts
//
// Minimal sliding-window rate limiter backed by the ratelimit_events(key, ts)
// table. Counts rows for a key within the window; over the limit → blocked. Uses
// the service-role client so counts/inserts bypass RLS. Best-effort on write so a
// logging hiccup never hard-blocks a legitimate request.
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return h.get('x-real-ip') || h.get('cf-connecting-ip') || 'unknown';
}

export type RateLimitResult = { ok: boolean; count: number; limit: number };

/**
 * Consume one unit against `key` over a rolling `windowSeconds` window. Returns
 * ok:false (without recording) once at/over `limit`. A limit <= 0 disables the
 * check (always ok).
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!(limit > 0)) return { ok: true, count: 0, limit };

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('ratelimit_events')
    .select('key', { count: 'exact', head: true })
    .eq('key', key)
    .gte('ts', since);

  const used = count ?? 0;
  if (used >= limit) return { ok: false, count: used, limit };

  await supabaseAdmin
    .from('ratelimit_events')
    .insert({ key, ts: new Date().toISOString() })
    .then(undefined, () => {});

  return { ok: true, count: used + 1, limit };
}
