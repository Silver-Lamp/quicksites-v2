// app/api/admin/domains/watchlist/route.ts
//
// Owner-facing CRUD for the domain watchlist (lib/domains/watchlist.ts).
//   GET                      → the list with each entry's last check
//   POST {domain, maxPriceUsd, note?}   → add or update a watch (status resets to watching)
//   DELETE {domain}          → stop watching
//   POST ?run=1              → run the check now (same code as the nightly cron)

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import {
  getWatchlist,
  setWatchlist,
  normalizeWatchDomain,
  runDomainWatch,
  defaultWatchDeps,
  type WatchEntry,
} from '@/lib/domains/watchlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ entries: await getWatchlist() });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  if (new URL(req.url).searchParams.get('run') === '1') {
    const report = await runDomainWatch(defaultWatchDeps());
    return NextResponse.json({ ok: true, ...report, entries: await getWatchlist() });
  }

  const body = await req.json().catch(() => ({}));
  let domain: string;
  try {
    domain = normalizeWatchDomain(body?.domain);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'invalid domain' }, { status: 400 });
  }
  const cap = Number(body?.maxPriceUsd);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 500) {
    return NextResponse.json({ error: 'maxPriceUsd must be a number between 1 and 500' }, { status: 400 });
  }

  const list = await getWatchlist();
  const existing = list.find((e) => e.domain === domain);
  const entry: WatchEntry = {
    ...(existing ?? { added_at: new Date().toISOString() }),
    domain,
    max_price_usd: Math.round(cap),
    note: typeof body?.note === 'string' ? body.note.slice(0, 500) : existing?.note,
    status: 'watching',
  };
  const next = [...list.filter((e) => e.domain !== domain), entry];
  await setWatchlist(next, gate.user.id);
  return NextResponse.json({ ok: true, entry });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;
  const body = await req.json().catch(() => ({}));
  let domain: string;
  try {
    domain = normalizeWatchDomain(body?.domain);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'invalid domain' }, { status: 400 });
  }
  const list = await getWatchlist();
  const next = list.map((e) => (e.domain === domain ? { ...e, status: 'stopped' as const } : e));
  await setWatchlist(next, gate.user.id);
  return NextResponse.json({ ok: true, entries: next });
}
