/**
 * @jest-environment node
 */
// components/analytics/__tests__/vercelAnalytics.test.ts
//
// Automation must not be counted as customers. PostHog enforces this by skipping init; custom
// events enforce it in lib/analytics/syntheticTraffic#track. Vercel Web Analytics owns its own
// script, so the only lever is `beforeSend` — and the bug would be invisible (a dashboard that
// simply reads high). These are source guards for exactly that reason.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const comp = readFileSync(join(process.cwd(), 'components/analytics/vercel-analytics.tsx'), 'utf8');
const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
const strip = (s: string) =>
  s
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n');

describe('Vercel Web Analytics is mounted once, behind the synthetic-visitor filter', () => {
  const body = strip(comp);

  it('filters automation with beforeSend, returning null to drop the event', () => {
    expect(body).toContain('isSyntheticVisitor');
    expect(body).toMatch(/beforeSend=\{\(event\)\s*=>\s*\{/);
    expect(body).toMatch(/if \(isSyntheticVisitor\(\)\) return null/);
  });

  it('uses the Next.js entrypoint', () => {
    expect(body).toContain("from '@vercel/analytics/next'");
  });

  it('is a client component (beforeSend is a function prop)', () => {
    expect(comp.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('is mounted exactly once, from the root layout', () => {
    const l = strip(layout);
    expect(l).toContain("import VercelAnalytics from '@/components/analytics/vercel-analytics'");
    expect(l.match(/<VercelAnalytics \/>/g) ?? []).toHaveLength(1);
  });

  it('the root layout does NOT mount the bare component (that would skip the filter)', () => {
    expect(strip(layout)).not.toMatch(/<Analytics\b/);
    expect(strip(layout)).not.toContain("from '@vercel/analytics");
  });
});
