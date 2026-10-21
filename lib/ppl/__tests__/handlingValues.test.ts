/**
 * @jest-environment node
 */
// lib/ppl/__tests__/handlingValues.test.ts — every `handling` value a Twilio route writes must be
// admitted by the LATEST `call_logs_handling_check` migration.
//
// ⚠️ Why: the check from 20260865 admitted five values; the screen branch (20260887) wrote
// 'screened' and the own-number branch wrote 'own_business', the constraint refused both, and
// because the entry route's logCall is best-effort (try/catch — a log must never block a
// forward) every screened and own-business call since 2026-10-15 was silently NOT LOGGED. Found
// 2026-10-21 while adding 'blocked'. A constraint and a route can disagree with no error anywhere;
// this reads both.
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/test/stripComments';

const ROOT = process.cwd();

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
}

/** The value list of the newest migration that (re)defines call_logs_handling_check. */
function allowedHandlingValues(): { file: string; values: string[] } {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let found: { file: string; values: string[] } | null = null;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = sql.match(/add constraint call_logs_handling_check[\s\S]*?handling in \(([^)]*)\)/i);
    if (m) found = { file: f, values: [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) };
  }
  if (!found) throw new Error('no migration defines call_logs_handling_check');
  return found;
}

describe('call_logs.handling: the routes and the constraint agree', () => {
  const allowed = allowedHandlingValues();
  const files: string[] = [];
  walk(path.join(ROOT, 'app', 'api', 'twilio'), files);
  walk(path.join(ROOT, 'lib', 'ppl'), files);

  it('scans a non-empty file set and a real constraint', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(allowed.values).toEqual(expect.arrayContaining(['forward', 'voicemail_first']));
  });

  it(`every handling literal written by a route is in ${allowedHandlingValues().file}`, () => {
    const written = new Map<string, string[]>();
    for (const f of files) {
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      for (const m of code.matchAll(/handling:\s*'([a-z_]+)'/g)) {
        const list = written.get(m[1]) ?? [];
        list.push(path.relative(ROOT, f));
        written.set(m[1], list);
      }
    }
    expect([...written.keys()]).toEqual(expect.arrayContaining(['screened', 'own_business', 'blocked']));
    const missing = [...written.entries()].filter(([v]) => !allowed.values.includes(v)).map(([v, where]) => `${v} (${where.join(', ')})`);
    expect(missing).toEqual([]);
  });
});
