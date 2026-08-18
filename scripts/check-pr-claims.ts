// scripts/check-pr-claims.ts
//
// Thin CI wrapper around lib/ci/prClaims.ts — reads the PR body from the GitHub event payload and
// exits non-zero when the PR does not say what it is betting on. All the reasoning (and the warning
// against "hardening" this into something a second party must satisfy) lives in the lib file.
//
// Local use, to see it pass or fail without opening a PR:
//   npx tsx scripts/check-pr-claims.ts --body "## Claims
//   - the thing I am betting on"
import { readFileSync } from 'node:fs';
import { readClaims, explain } from '../lib/ci/prClaims';

function bodyFromArgs(): string | null {
  const i = process.argv.indexOf('--body');
  return i !== -1 ? (process.argv[i + 1] ?? '') : null;
}

function bodyFromEvent(): string | null {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) return null;
  try {
    const event = JSON.parse(readFileSync(path, 'utf8'));
    return event?.pull_request?.body ?? '';
  } catch {
    return null;
  }
}

const body = bodyFromArgs() ?? bodyFromEvent();

if (body === null) {
  // No event and no --body: nothing to judge. Pass rather than fail, because a checker that goes
  // red when it cannot find its input teaches people to ignore red.
  console.log('check-pr-claims: no PR body available (not a pull_request event) — skipping.');
  process.exit(0);
}

const verdict = readClaims(body);
console.log(explain(verdict));
process.exit(verdict.ok ? 0 : 1);
