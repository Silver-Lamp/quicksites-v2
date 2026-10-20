/**
 * @jest-environment node
 */
// lib/repo/__tests__/migrationsEnableRls.test.ts — a table created in `public` without RLS is
// readable and writable by the anon key that ships in every browser bundle. call_logs was created
// that way in September 2026 and carried callers' phone numbers and voicemail transcripts until
// Supabase's advisor flagged it (docs/SECURITY_ADVISOR_2026-10.md). From migration 20260900 on,
// a migration that creates a public table must enable row level security on it in the same file.
// Policies are a design decision per table; the ENABLE is not.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'supabase', 'migrations');
const SINCE = '20260900';

function strip(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('migrations from 20260900 enable RLS on every public table they create', () => {
  const files = fs.readdirSync(DIR).filter((f) => /^\d{8}/.test(f) && f.endsWith('.sql') && f.slice(0, 8) >= SINCE).sort();

  it('scans at least the first such migration', () => {
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  it('every `create table` in public is followed by `enable row level security` for that table', () => {
    const misses: string[] = [];
    for (const f of files) {
      const sql = strip(fs.readFileSync(path.join(DIR, f), 'utf8')).toLowerCase();
      const created = Array.from(sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?/g)).map((m) => m[1]);
      for (const t of created) {
        const enabled = new RegExp(`alter\\s+table\\s+(?:public\\.)?"?${t}"?\\s+enable\\s+row\\s+level\\s+security`).test(sql);
        if (!enabled) misses.push(`${f}: public.${t}`);
      }
    }
    expect(misses).toEqual([]);
  });
});
