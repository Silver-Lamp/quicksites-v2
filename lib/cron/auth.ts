// lib/cron/auth.ts
// One predicate for "is this request an authorized cron invocation?" — accepts
// Vercel's native `Authorization: Bearer <CRON_SECRET>` (GET) as well as the
// custom `x-cron-secret` / `x-cron-key` headers used by the existing crons.
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers;
  return (
    h.get('x-cron-secret') === secret ||
    h.get('x-cron-key') === secret ||
    h.get('authorization') === `Bearer ${secret}`
  );
}
