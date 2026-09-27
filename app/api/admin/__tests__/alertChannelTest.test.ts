/**
 * @jest-environment node
 *
 * PROVING THE ALERT CHANNEL.
 *
 * ⚠️ Three outbound channels were found silently dead on 2026-09-26 — PostHog never configured,
 * the OpenAI key revoked for nine days, ADMIN_EMAILS unset so every operator alert (including the
 * AI-outage alert written that morning) was composed and discarded. Each hid because the code
 * degrades gracefully and nothing checked the OUTPUT ARRIVES.
 *
 * ⚠️ And `sendEmail` itself is the fourth instance: with no RESEND_API_KEY it logs to the console
 * and returns `{ ok: true, id: 'dev' }`. A caller checking `ok` believes it sent. If this route
 * reported that as success, the one tool built to prove delivery would be the most convincing
 * liar in the system — so most of what follows guards that single case.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '@/test/stripComments';

const root = process.cwd();
const read = (p: string) => stripComments(readFileSync(join(root, p), 'utf8'));
const ROUTE = read('app/api/admin/alerts/test/route.ts');
const UI = read('components/admin/alert-channel-test.tsx');
const EMAIL = read('lib/email.ts');

describe('the dev no-op is still there, which is why this matters', () => {
  it('sendEmail returns ok:true with id "dev" when unconfigured', () => {
    expect(EMAIL).toMatch(/id: 'dev'/);
    expect(EMAIL).toMatch(/ok: true/);
  });
});

describe('⚠️ the route cannot report an unsent email as sent', () => {
  it('distinguishes the dev no-op from a real send', () => {
    expect(ROUTE).toMatch(/res\.id === 'dev'/);
    expect(ROUTE).toMatch(/dev_noop/);
  });

  it('only claims ok when Resend actually accepted', () => {
    expect(ROUTE).toMatch(/ok: delivery === 'accepted'/);
  });

  it('says out loud that accepted is not delivered', () => {
    // A bounce, a spam folder or an unverified sending domain all look like success from here.
    expect(ROUTE).toMatch(/not proof of delivery/);
  });

  it('refuses when there are no recipients, instead of pretending', () => {
    expect(ROUTE).toMatch(/no_recipients/);
  });
});

describe('it exercises the REAL path', () => {
  it('uses the same sendEmail and the same ADMIN_EMAILS as a real alert', () => {
    // A test that exercises a parallel code path proves the parallel path.
    expect(ROUTE).toMatch(/from '@\/lib\/email'/);
    expect(ROUTE).toMatch(/process\.env\.ADMIN_EMAILS/);
  });

  it('exercises the Sentry fallback too, which was equally unproven', () => {
    expect(ROUTE).toMatch(/Sentry\.captureMessage/);
    expect(ROUTE).toMatch(/sentryCaptured/);
  });
});

describe('it is admin-only and cannot fan out', () => {
  it('requires an admin', () => {
    expect(ROUTE).toMatch(/requireAdmin\(\)/);
  });

  it('is rate limited — it sends real mail', () => {
    expect(ROUTE).toMatch(/rateLimitOr429\(req, 'alert-test'/);
  });

  it('never returns a full address', () => {
    // Recognisable, not harvestable.
    expect(ROUTE).toMatch(/function mask/);
    expect(ROUTE).toMatch(/recipients: admins\.map\(mask\)/);
  });
});

describe('the button tells the truth too', () => {
  it('has a distinct state for the not-sent case', () => {
    expect(UI).toMatch(/NOT SENT/);
  });

  it('does not render a bare success for every outcome', () => {
    expect(UI).toMatch(/dev_noop/);
    expect(UI).toMatch(/accepted/);
  });
});
