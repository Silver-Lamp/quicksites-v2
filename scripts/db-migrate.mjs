#!/usr/bin/env node
// scripts/db-migrate.mjs — minimal, dependency-free migration tracker for the
// hand-applied Supabase migrations in supabase/migrations/*.sql.
//
// This repo has historically applied migrations by hand (psql -f) with NO record
// of what's live, so the only way to know prod's state was to probe each object.
// This runner adds a `public.schema_migrations` ledger and three commands:
//
//   node scripts/db-migrate.mjs status     # (default) show applied vs pending + drift
//   node scripts/db-migrate.mjs up         # apply pending migrations, in order, each
//                                          #   in ONE transaction, recording on success
//   node scripts/db-migrate.mjs backfill   # mark all present files as applied WITHOUT
//                                          #   running them (bootstrap an existing DB)
//
// The connection string is read from SUPABASE_DB_URL (env, or the .env.local line).
// It's a libpq keyword string (host=... dbname=... sslmode=require), not a URL.
//
// npm aliases: db:migrate:status | db:migrate:up | db:migrate:backfill

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

function resolveConn() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) fail('No SUPABASE_DB_URL in env and no .env.local found.');
  const line = readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('SUPABASE_DB_URL='));
  if (!line) fail('SUPABASE_DB_URL not found in .env.local.');
  return line.replace(/^SUPABASE_DB_URL=/, '').replace(/^"/, '').replace(/"$/, '').trim();
}

function resolvePsql() {
  for (const p of ['/opt/homebrew/bin/psql', '/usr/local/bin/psql', 'psql']) {
    try {
      execFileSync(p, ['--version'], { stdio: 'ignore' });
      return p;
    } catch {
      /* try next */
    }
  }
  fail('psql not found (looked in /opt/homebrew, /usr/local, PATH).');
}

const CONN = resolveConn();
const PSQL = resolvePsql();

// Run a read query, return rows as arrays of column strings (tab-separated, -tA).
function query(sql) {
  const out = execFileSync(PSQL, [CONN, '-tA', '-F', '\t', '-c', sql], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((r) => r.split('\t'));
}

function ensureLedger() {
  query(`
    create table if not exists public.schema_migrations (
      version     text primary key,
      name        text not null,
      checksum    text,
      backfilled  boolean not null default false,
      applied_at  timestamptz not null default now()
    );
  `);
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const body = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      return { file: f, version: f.replace(/\.sql$/, ''), checksum: createHash('sha256').update(body).digest('hex').slice(0, 16) };
    });
}

function appliedMap() {
  const rows = query(`select version, checksum, backfilled from public.schema_migrations;`);
  return new Map(rows.map(([version, checksum, backfilled]) => [version, { checksum, backfilled: backfilled === 't' }]));
}

// SQL string literal escape (single quotes). Versions/checksums are safe chars,
// but escape anyway for correctness.
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function recordSql(m, backfilled) {
  return `insert into public.schema_migrations (version, name, checksum, backfilled)
          values (${lit(m.version)}, ${lit(m.file)}, ${lit(m.checksum)}, ${backfilled ? 'true' : 'false'})
          on conflict (version) do nothing;`;
}

function cmdStatus() {
  const files = migrationFiles();
  const applied = appliedMap();
  let pending = 0;
  let drift = 0;
  console.log(`\n  schema_migrations — ${files.length} file(s) in supabase/migrations/\n`);
  for (const m of files) {
    const rec = applied.get(m.version);
    if (!rec) {
      pending++;
      console.log(`  \x1b[33mPENDING\x1b[0m  ${m.version}`);
    } else if (rec.checksum && rec.checksum !== m.checksum) {
      drift++;
      console.log(`  \x1b[35mCHANGED\x1b[0m  ${m.version}  (file edited since apply: ${rec.checksum} → ${m.checksum})`);
    } else {
      console.log(`  \x1b[32mok\x1b[0m       ${m.version}${rec.backfilled ? '  (backfilled)' : ''}`);
    }
  }
  // Recorded rows with no corresponding file (deleted migrations).
  const fileVersions = new Set(files.map((m) => m.version));
  for (const version of applied.keys()) {
    if (!fileVersions.has(version)) console.log(`  \x1b[31mORPHAN\x1b[0m   ${version}  (recorded but no file)`);
  }
  console.log(`\n  ${files.length - pending}/${files.length} applied · ${pending} pending${drift ? ` · ${drift} changed` : ''}\n`);
  if (pending) console.log('  Run `npm run db:migrate:up` to apply pending migrations.\n');
}

function cmdUp() {
  const files = migrationFiles();
  const applied = appliedMap();
  const pending = files.filter((m) => !applied.has(m.version));
  if (!pending.length) {
    console.log('\n  Nothing to apply — all migrations recorded.\n');
    return;
  }
  console.log(`\n  Applying ${pending.length} pending migration(s):\n`);
  for (const m of pending) {
    process.stdout.write(`  → ${m.version} ... `);
    try {
      // Migration file AND its ledger insert run in ONE transaction: if the file
      // errors, the record is rolled back too, so the ledger never lies.
      execFileSync(
        PSQL,
        [CONN, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', join(MIGRATIONS_DIR, m.file), '-c', recordSql(m, false)],
        { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
      );
      console.log('\x1b[32mdone\x1b[0m');
    } catch (e) {
      console.log('\x1b[31mFAILED\x1b[0m');
      console.error((e.stderr || e.message || '').toString().trim());
      fail(`Stopped at ${m.version}. Earlier migrations are applied + recorded; fix and re-run.`);
    }
  }
  console.log('\n  All pending migrations applied.\n');
}

function cmdBackfill() {
  const files = migrationFiles();
  const applied = appliedMap();
  const toRecord = files.filter((m) => !applied.has(m.version));
  if (!toRecord.length) {
    console.log('\n  Nothing to backfill — every file is already recorded.\n');
    return;
  }
  console.log(`\n  Backfilling ${toRecord.length} migration(s) as applied (NOT executing them):\n`);
  const sql = toRecord.map((m) => recordSql(m, true)).join('\n');
  query(sql);
  for (const m of toRecord) console.log(`  recorded  ${m.version}`);
  console.log('\n  Done. These are marked backfilled — verify they truly match prod.\n');
}

ensureLedger();
const cmd = process.argv[2] || 'status';
if (cmd === 'status') cmdStatus();
else if (cmd === 'up') cmdUp();
else if (cmd === 'backfill') cmdBackfill();
else fail(`Unknown command "${cmd}". Use: status | up | backfill`);
