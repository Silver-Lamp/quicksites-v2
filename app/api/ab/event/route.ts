// POST /api/ab/event — record one A/B event for the visitor's variant; on the first exposure
// (`assign: true`) set the sticky assignment cookie for that experiment. Public, rate-limited,
// drops automation by UA (lib/analytics/syntheticTraffic), stores no IP or UA. DB first
// (ab_events), PostHog as a mirror. Experiments: `homepage_hero` or `site:<template_id>`.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { isSyntheticRequest } from '@/lib/analytics/syntheticTraffic';
import { captureServer } from '@/lib/analytics/posthog-server';
import { AB_COOKIE, AB_COOKIE_DAYS, AB_EXPERIMENT, isAbEventName } from '@/lib/ab/homepage';
import { siteAbCookie, templateIdFromExperiment } from '@/lib/ab/siteAb';
import { recordAbEvent } from '@/lib/ab/homepageDb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VISITOR_COOKIE = 'qs_ab_visitor';

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'ab-event', 120, 3600);
  if (limited) return limited;
  if (isSyntheticRequest(req.headers.get('user-agent'))) return NextResponse.json({ ok: true, skipped: 'synthetic' });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const variant = body?.variant === 'A' || body?.variant === 'B' ? body.variant : null;
  const event = isAbEventName(body?.event) ? body.event : null;
  const experiment = typeof body?.experiment === 'string' ? body.experiment : AB_EXPERIMENT;
  const templateId = experiment === AB_EXPERIMENT ? null : templateIdFromExperiment(experiment);
  if (!variant || !event || (experiment !== AB_EXPERIMENT && !templateId)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : null;
  const cookieName = templateId ? siteAbCookie(templateId) : AB_COOKIE;

  // The visitor id is its own cookie so a re-assignment (e.g. the test reset) keeps the person.
  let visitor = req.cookies.get(VISITOR_COOKIE)?.value ?? '';
  const newVisitor = !/^[0-9a-f-]{36}$/i.test(visitor);
  if (newVisitor) visitor = randomUUID();

  await recordAbEvent({ experiment, variant, visitor, event, path }).catch(() => undefined);
  void captureServer(`ab_${event}`, { experiment, variant, path }, visitor).catch(() => undefined);

  const res = NextResponse.json({ ok: true });
  const maxAge = AB_COOKIE_DAYS * 86400;
  if (newVisitor) res.cookies.set({ name: VISITOR_COOKIE, value: visitor, path: '/', maxAge, sameSite: 'lax', httpOnly: true, secure: true });
  if (body?.assign === true && !req.cookies.get(cookieName)) res.cookies.set({ name: cookieName, value: variant, path: '/', maxAge, sameSite: 'lax', secure: true });
  return res;
}
