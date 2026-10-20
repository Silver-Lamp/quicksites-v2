// scripts/rls-probe.mts — what can the PUBLIC anon key, and a signed-in nobody, actually do to
// each table through the REST API? The Supabase advisor emails a category ("rls_disabled_in_public")
// and no table names; this re-derives the list and PROVES exposure the way an attacker would —
// a real request with the key that ships in every browser bundle — so a fix can be checked by
// re-running it rather than by trusting a dashboard tick.
//
//   npx tsx --env-file=.env.local scripts/rls-probe.mts                # every public table, anon only
//   npx tsx --env-file=.env.local scripts/rls-probe.mts --authed       # also a throwaway signed-in user
//   npx tsx --env-file=.env.local scripts/rls-probe.mts --write        # also try an INSERT of {} (rolled back by RLS or a 400 on NOT NULL — never leaves a row on a table that accepts it: we DELETE what we inserted)
//   npx tsx --env-file=.env.local scripts/rls-probe.mts --only call_logs,snapshots
//
// Output: one line per table — anon read (status + row count), authed read, optional write — and a
// tally. Read-only unless --write. Needs SUPABASE_DB_URL (to list tables), the anon key, and the
// service-role key (to mint the throwaway user when --authed).
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)!;
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!;
const DB = process.env.SUPABASE_DB_URL!;
const AUTHED = process.argv.includes('--authed');
const WRITE = process.argv.includes('--write');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;

async function tables(): Promise<Array<{ name: string; kind: string; rls: boolean }>> {
  // psql, not a driver: the repo has no `pg` dependency and every other script here lists this way.
  const out = execFileSync('psql', [DB, '-X', '-At', '-F', '|', '-c', `select c.relname, c.relkind, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v') order by 1`], { encoding: 'utf8' });
  return out.trim().split('\n').filter(Boolean).map((l) => { const [name, kind, rls] = l.split('|'); return { name, kind: kind === 'v' ? 'view' : 'table', rls: rls === 't' }; });
}

async function read(token: string, t: string): Promise<{ status: number; rows: number | null }> {
  const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${token}`, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range');
  const rows = cr && /\/(\d+)$/.test(cr) ? Number(cr.split('/')[1]) : null;
  return { status: r.status, rows };
}

async function tryWrite(token: string, t: string): Promise<string> {
  // An INSERT of {} is refused by RLS (401/403) or by a NOT NULL/default (400) — a 201 means the
  // table accepted an anonymous row, which is then deleted by its returned id when there is one.
  const r = await fetch(`${URL}/rest/v1/${t}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'content-type': 'application/json', Prefer: 'return=representation' }, body: '{}' });
  if (r.status === 201) {
    const rows = await r.json().catch(() => []);
    const id = rows?.[0]?.id;
    if (id) await fetch(`${URL}/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    return `201 ACCEPTED${id ? ' (deleted)' : ' (no id — a row may remain)'}`;
  }
  return String(r.status);
}

async function throwawayJwt(): Promise<string> {
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const email = `rls-probe+${Date.now()}@example.invalid`;
  const password = `P${Math.random().toString(36).slice(2)}!${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2 || !s.session) throw new Error(`signIn: ${e2?.message}`);
  // Delete the user at the end of the run.
  process.on('beforeExit', () => { admin.auth.admin.deleteUser(data.user!.id).catch(() => undefined); });
  return s.session.access_token;
}

async function main() {
  const all = await tables();
  const list = ONLY ? all.filter((t) => ONLY.includes(t.name)) : all;
  const authed = AUTHED ? await throwawayJwt() : null;
  const tally = { anonReadable: 0, anonRows: 0, authedReadable: 0, anonWritable: 0 };
  const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
  console.log(pad('table', 34) + pad('rls', 5) + pad('anon read', 16) + (authed ? pad('authed read', 16) : '') + (WRITE ? 'anon insert' : ''));
  for (const t of list) {
    const a = await read(ANON, t.name);
    const aOk = a.status >= 200 && a.status < 300;
    if (aOk) { tally.anonReadable += 1; tally.anonRows += a.rows ?? 0; }
    let line = pad(t.name, 34) + pad(t.kind === 'view' ? 'view' : t.rls ? 'on' : 'OFF', 5) + pad(`${a.status}${aOk ? ` rows=${a.rows ?? '?'}` : ''}`, 16);
    if (authed) { const u = await read(authed, t.name); const uOk = u.status >= 200 && u.status < 300; if (uOk) tally.authedReadable += 1; line += pad(`${u.status}${uOk ? ` rows=${u.rows ?? '?'}` : ''}`, 16); }
    if (WRITE) { const w = await tryWrite(ANON, t.name); if (w.startsWith('201')) tally.anonWritable += 1; line += w; }
    console.log(line);
  }
  console.log(`\n${list.length} relations · anon-readable ${tally.anonReadable} (rows visible ${tally.anonRows})` + (authed ? ` · authed-readable ${tally.authedReadable}` : '') + (WRITE ? ` · anon-insertable ${tally.anonWritable}` : ''));
}
main().catch((e) => { console.error(e); process.exit(1); });
