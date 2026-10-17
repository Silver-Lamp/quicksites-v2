// GET /api/partner/hj/people?days=60 — QuickSites' people (lib/people/qsPeople.ts) with daily
// visit counts to each /for-<name> page, for HiveJournal's /dashboard/admin/people
// (crosstalk/contracts/people-registry.md). Server-to-server: `X-Partner-Id: hivejournal` +
// `X-Partner-Signature` = hex HMAC-SHA256 over `pathname + search` with PARTNER_QUICKSITES_SECRET
// (the booking-day scheme). Fail-closed 503 without the secret. Names, relations and counts
// only — no emails, no visitor identities; visits are daily totals from PostHog.
import { NextResponse, type NextRequest } from 'next/server';
import { verifyPartnerSignature } from '@/lib/partners/artistSite';
import { QS_PEOPLE } from '@/lib/people/qsPeople';
import { hogqlString, posthogHogql, posthogQueryUnavailableReason } from '@/lib/analytics/posthogQuery';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'partner-people', 60, 3600);
  if (limited) return limited;
  if (!process.env.PARTNER_QUICKSITES_SECRET) return NextResponse.json({ error: 'partner_secret_unset' }, { status: 503 });
  if (req.headers.get('x-partner-id') !== 'hivejournal') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL(req.url);
  if (!verifyPartnerSignature(`${url.pathname}${url.search}`, req.headers.get('x-partner-signature'), process.env.PARTNER_QUICKSITES_SECRET)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  }
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days') ?? 60) || 60));

  // Daily visits per page from PostHog. Unavailable → the people still come back, with the reason.
  const visits = new Map<string, Array<{ day: string; visits: number; visitors: number }>>();
  let visitsUnavailable: string | null = posthogQueryUnavailableReason();
  if (!visitsUnavailable) {
    const like = QS_PEOPLE.map((p) => `properties.$current_url like ${hogqlString(`%quicksites.ai${p.pitchPath}%`)}`).join(' or ');
    const q =
      `select toDate(timestamp) as day, cutQueryStringAndFragment(properties.$current_url) as url, count() as views, count(distinct distinct_id) as visitors ` +
      `from events where event = '$pageview' and timestamp > now() - interval ${days} day and (${like}) group by day, url order by day`;
    const res = await posthogHogql(q, { timeoutMs: 12_000 }).catch(() => null);
    if (!res) visitsUnavailable = 'posthog query failed';
    else {
      for (const row of res.results as Array<[string, string, number, number]>) {
        const [day, pageUrl, views, visitors] = row;
        const person = QS_PEOPLE.find((p) => String(pageUrl).toLowerCase().includes(`quicksites.ai${p.pitchPath}`));
        if (!person) continue;
        const list = visits.get(person.key) ?? [];
        const existing = list.find((d) => d.day === String(day).slice(0, 10));
        if (existing) {
          existing.visits += Number(views) || 0;
          existing.visitors += Number(visitors) || 0;
        } else list.push({ day: String(day).slice(0, 10), visits: Number(views) || 0, visitors: Number(visitors) || 0 });
        visits.set(person.key, list);
      }
    }
  }

  return NextResponse.json({
    product: 'quicksites',
    base: 'https://www.quicksites.ai',
    days,
    generatedAt: new Date().toISOString(),
    visitsUnavailable,
    people: QS_PEOPLE.map((p) => ({ ...p, url: `https://www.quicksites.ai${p.pitchPath}`, visits: visits.get(p.key) ?? [] })),
  });
}
