// The admin nav-click logger (/api/log-event → nav_events) never wrote a row in its life: it
// inserted with the anon-key client into a table the 2026-07 RLS hardening closed, and nothing
// read the result. Found 2026-10-11 while looking for traffic on the salmon page — a logger that
// silently records nothing is the dead-watchdog pattern. Removed; pageviews live in PostHog
// (scripts/posthog-traffic.mts). This guard keeps a new caller from reviving the dead endpoint.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('no dead nav logger', () => {
  it('nothing references /api/log-event and the route is gone', () => {
    // ⚠️ Exclude this file: `git grep` searches TRACKED files, so once the guard was committed its
    // own comment matched and CI failed while the untracked local run passed (2026-10-11).
    const hits = execSync("git grep -l '/api/log-event' -- app components lib middleware.ts ':!lib/repo/__tests__/noDeadNavLogger.test.ts' || true", { cwd: process.cwd() }).toString().trim();
    expect(hits).toBe('');
    expect(fs.existsSync(path.join(process.cwd(), 'app/api/log-event/route.ts'))).toBe(false);
  });
});
