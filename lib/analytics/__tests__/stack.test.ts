/**
 * @jest-environment node
 */
// lib/analytics/__tests__/stack.test.ts
//
// THE ANTI-ROT MECHANISM for /admin/analytics. An architecture diagram is true the day it is drawn
// and quietly wrong afterwards (CLAUDE.md §4). So the page is drawn from lib/analytics/stack.ts,
// and this test asserts the registry still matches the repo:
//
//   • every file the registry claims still exists;
//   • every file in the repo that imports an analytics SDK is DECLARED in the registry — add a
//     fifth collector and the build goes red until the diagram knows about it;
//   • every browser-side collector states how it drops automation (the rule all of them honour);
//   • status is derived from env presence, both branches.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ANALYTICS_SYSTEMS,
  ANALYTICS_SDK_IMPORTS,
  declaredSourceFiles,
  describeAnalyticsStack,
} from '@/lib/analytics/stack';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components', 'lib'];

/** Every .ts/.tsx file under the scanned dirs, excluding tests. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(relative(ROOT, full));
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return out;
}

describe('the analytics registry matches the repo', () => {
  it('scans a real set of files (a sweep matching nothing reports success)', () => {
    expect(sourceFiles().length).toBeGreaterThan(200);
  });

  it('every file the registry claims still exists', () => {
    for (const p of declaredSourceFiles()) {
      expect({ path: p, exists: existsSync(join(ROOT, p)) }).toEqual({ path: p, exists: true });
    }
  });

  it('every analytics call site in the repo is declared in the registry', () => {
    const declared = new Set(declaredSourceFiles());
    const callSites = sourceFiles().filter((p) => {
      const src = readFileSync(join(ROOT, p), 'utf8');
      // An import, not a mention: the registry and this test both name the SDKs in prose.
      return ANALYTICS_SDK_IMPORTS.some((sdk) => new RegExp(`from '${sdk.replace('/', '\\/')}(/[a-z]+)?'`).test(src));
    });
    const undeclared = callSites.filter((p) => !declared.has(p));
    expect({ undeclared, hint: 'add it to ANALYTICS_SYSTEMS in lib/analytics/stack.ts' }).toEqual({
      undeclared: [],
      hint: 'add it to ANALYTICS_SYSTEMS in lib/analytics/stack.ts',
    });
    expect(callSites.length).toBeGreaterThan(0);
  });

  it('every browser-side collector declares how it drops automation', () => {
    for (const s of ANALYTICS_SYSTEMS.filter((x) => x.side === 'client')) {
      expect({ id: s.id, automation: s.automation }).not.toEqual({ id: s.id, automation: 'none' });
    }
  });

  it('the automation rule each browser collector claims is actually in its source', () => {
    const marker: Record<string, string> = {
      skip_init: 'isSyntheticVisitor',
      before_send: 'beforeSend',
      wrapper: 'isSyntheticVisitor',
    };
    for (const s of ANALYTICS_SYSTEMS.filter((x) => x.side === 'client')) {
      const needle = marker[s.automation];
      const found = s.sources.some((p) => readFileSync(join(ROOT, p), 'utf8').includes(needle));
      expect({ id: s.id, needle, found }).toEqual({ id: s.id, needle, found: true });
    }
  });
});

describe('describeAnalyticsStack reads the running process', () => {
  it('a system with no env keys is configured by construction', () => {
    const vercel = describeAnalyticsStack({}).find((s) => s.system.id === 'vercel_analytics')!;
    expect(vercel.status).toBe('configured');
    expect(vercel.envMissing).toEqual([]);
  });

  it('a system whose keys are all absent is not configured, and says which are missing', () => {
    const ph = describeAnalyticsStack({}).find((s) => s.system.id === 'posthog_client')!;
    expect(ph.status).toBe('not_configured');
    expect(ph.envMissing).toContain('NEXT_PUBLIC_POSTHOG_KEY');
  });

  it('one of several alternative keys is enough', () => {
    const ph = describeAnalyticsStack({ POSTHOG_KEY: 'phc_x' }).find((s) => s.system.id === 'posthog_server')!;
    expect(ph.status).toBe('configured');
    expect(ph.envPresent).toEqual(['POSTHOG_KEY']);
  });

  it('reports key NAMES only — no value ever reaches the page', () => {
    const s = describeAnalyticsStack({ POSTHOG_KEY: 'phc_secret_value' }).find((x) => x.system.id === 'posthog_server')!;
    expect(JSON.stringify(s)).not.toContain('phc_secret_value');
  });
});
