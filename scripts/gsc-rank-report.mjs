#!/usr/bin/env node
// scripts/gsc-rank-report.mjs
//
// What do our own domains actually rank for? Reads every connected Search Console property and
// reports 28-day clicks / impressions / average position, plus the top queries per site.
//
//   node scripts/gsc-rank-report.mjs            # table
//   node scripts/gsc-rank-report.mjs --json     # machine-readable, for seeding a page
//
// Read-only: refreshes an access token and queries Search Analytics. Writes nothing.
//
// ⚠️ NEVER PRINT THE TOKENS. gsc_tokens rows carry live access + refresh tokens; this script
// reads them and emits only domains and metrics. Do not add a debug dump of the row.
//
// ⚠️ "unranked" IN geo_industry_campaigns IS A DEFAULT, NOT A MEASUREMENT. All 99 campaigns read
// `rank_status: 'unranked'` and 0 have ever been rank-synced — meaning nobody has looked, not that
// they do not rank. Different thing, and the difference matters if it is ever shown to a customer.

import fs from 'node:fs';
import { classifyQuery } from '../lib/proof/queryKind.ts';

const JSON_OUT = process.argv.includes('--json');
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const CLIENT_ID = env.GOOGLE_CLIENT_ID || env.GSC_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET || env.GSC_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET)
  throw new Error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const tokens = await (
  await fetch(`${BASE}/rest/v1/gsc_tokens?select=domain,refresh_token`, { headers: H })
).json();

async function accessToken(refresh) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`token refresh ${res.status}`);
  return (await res.json()).access_token;
}

const end = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10); // GSC lags ~3 days
const start = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);

async function query(site, at, dimensions, rowLimit) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions, rowLimit }),
    }
  );
  if (!res.ok) return null;
  return (await res.json()).rows ?? [];
}

const out = [];
for (const t of tokens) {
  const site = t.domain;
  let at;
  try {
    at = await accessToken(t.refresh_token);
  } catch (e) {
    out.push({ site, error: `auth: ${e.message}` });
    continue;
  }
  const totals = await query(site, at, [], 1);
  if (totals === null) {
    out.push({ site, error: 'no access to property' });
    continue;
  }
  const row = totals[0];
  const queries = (await query(site, at, ['query'], 8)) ?? [];
  out.push({
    site,
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    position: row?.position ? Math.round(row.position * 10) / 10 : null,
    topQueries: queries.map((q) => ({
      query: q.keys[0],
      clicks: q.clicks,
      impressions: q.impressions,
      position: Math.round(q.position * 10) / 10,
    })),
  });
}

// `kind` comes from lib/proof/queryKind.ts — the SAME module the internal rate card uses.
// It lived here as a private copy for exactly one commit, which was already one too many: the
// prospect-facing proof page and the rate card must never disagree about which domains qualify.
// This file is .mjs importing .ts, so run it under tsx:
//   npx tsx scripts/gsc-rank-report.mjs --json > lib/proof/rankingSnapshot.json

if (JSON_OUT) {
  // Emit the shape /proof/rankings actually reads (lib/proof/rankingSnapshot.json), not a
  // near-miss of it: measuredAt/window/sites[host,queries[...kind]]/unreadable.
  const snapshot = {
    measuredAt: new Date().toISOString().slice(0, 10),
    window: { start, end },
    sites: out
      .filter((o) => !o.error)
      .map((o) => ({
        host: o.site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^sc-domain:/, '').replace(/\/$/, ''),
        clicks: o.clicks,
        impressions: o.impressions,
        position: o.position,
        queries: (o.topQueries || []).map((q) => ({ ...q, kind: classifyQuery(q.query, o.site) })),
      })),
    unreadable: out
      .filter((o) => o.error)
      .map((o) => ({ host: o.site.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''), error: o.error })),
  };
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

const ranked = out
  .filter((o) => !o.error && o.impressions > 0)
  .sort((a, b) => b.impressions - a.impressions);
const quiet = out.filter((o) => !o.error && !o.impressions);
const bad = out.filter((o) => o.error);
console.log(`\nGSC ${start} → ${end}  ·  ${tokens.length} connected properties\n`);
console.log(
  `  ${'domain'.padEnd(36)} ${'clicks'.padStart(7)} ${'impr'.padStart(8)} ${'avg pos'.padStart(8)}`
);
for (const o of ranked) {
  console.log(
    `  ${o.site.replace(/^https?:\/\/|\/$/g, '').padEnd(36)} ${String(o.clicks).padStart(7)} ${String(o.impressions).padStart(8)} ${String(o.position ?? '-').padStart(8)}`
  );
}
console.log(
  `\n  with impressions: ${ranked.length} · zero impressions: ${quiet.length} · unreadable: ${bad.length}`
);
for (const o of bad) console.log(`    ⚠️  ${o.site} — ${o.error}`);

const top = ranked
  .flatMap((o) => o.topQueries.map((q) => ({ site: o.site, ...q })))
  .filter((q) => q.position <= 10)
  .sort((a, b) => a.position - b.position)
  .slice(0, 20);
console.log(`\n  queries ranking on PAGE ONE (position ≤ 10): ${top.length}`);
for (const q of top) {
  console.log(
    `    #${String(q.position).padStart(4)}  ${q.query.slice(0, 40).padEnd(42)} ${q.site.replace(/^https?:\/\/|\/$/g, '')}`
  );
}
