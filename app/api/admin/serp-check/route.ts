// app/api/admin/serp-check/route.ts
//
// The human SERP check: GET a run (the worklist plus anything already answered and whatever the
// machine said about the same queries), POST one row's answers.
//
// ⚠️ THE VERDICT IS COMPUTED SERVER-SIDE FROM `readHumanSerp`, never taken from the client. The
// point of the whole exercise is that a person's reading and the API's run through the SAME rule,
// so a body that sends its own `verdict` is ignored rather than trusted — otherwise the scoring
// lives in two places and the comparison stops meaning anything.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { readHumanSerp, readHumanSerpNoOrganic, type FirstOrganicKind } from '@/lib/serp/classify';
import { nicheWorklist, summarise, worksheetWorklist, type WorklistStep } from '@/lib/serp/worklist';
import { NICHE_CANDIDATES } from '@/lib/niches/candidates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

const KINDS: FirstOrganicKind[] = ['directory', 'forum', 'video', 'retail', 'unknown'];

function worklistFor(searchParams: URLSearchParams): WorklistStep[] {
  const niche = searchParams.get('niche');
  if (!niche) return worksheetWorklist();
  const c = NICHE_CANDIDATES.find((x) => x.key === niche);
  if (!c) throw new Error(`No candidate "${niche}"`);
  const cities = (searchParams.get('cities') ?? 'Austin').split(',').map((s) => s.trim()).filter(Boolean);
  return nicheWorklist(c.key, c.queries, cities);
}

export async function GET(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let steps: WorklistStep[];
  try {
    steps = worklistFor(req.nextUrl.searchParams);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'bad set' }, { status: 400 });
  }

  const db = admin();
  const queries = steps.map((s) => s.query);
  const { data: rows } = await db
    .from('serp_observations')
    .select('query, location, provider, pack_size, first_organic_kind, first_organic_domain, verdict, reason, checked_at, notes')
    .in('query', queries)
    .order('checked_at', { ascending: false });

  const key = (q: string, l: string) => `${q}|${l}`;
  const human = new Map<string, Record<string, unknown>>();
  const machine = new Map<string, Record<string, unknown>>();
  for (const r of rows ?? []) {
    const m = r.provider === 'human' ? human : machine;
    const k = key(r.query, r.location);
    if (!m.has(k)) m.set(k, r); // newest wins — the query is ordered desc
  }

  return NextResponse.json({
    ok: true,
    steps: steps.map((s) => ({
      ...s,
      human: human.get(key(s.query, s.location)) ?? null,
      machine: machine.get(key(s.query, s.location)) ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const query = String(body?.query ?? '').trim();
  const location = String(body?.location ?? '').trim();
  if (!query || !location) {
    return NextResponse.json({ error: 'query and location are required' }, { status: 400 });
  }

  const packSize = Number(body?.packSize);
  if (!Number.isFinite(packSize) || packSize < 0 || packSize > 20) {
    return NextResponse.json({ error: 'packSize must be 0–20' }, { status: 400 });
  }
  const noOrganic = body?.noOrganic === true;
  const kindRaw = String(body?.firstOrganicKind ?? 'unknown') as FirstOrganicKind;
  const firstOrganicKind = KINDS.includes(kindRaw) ? kindRaw : 'unknown';

  // Server-side scoring, from the shared rule. A client-sent verdict is ignored.
  const reading = noOrganic
    ? readHumanSerpNoOrganic(query, location, packSize)
    : readHumanSerp({
        query,
        location,
        packSize,
        firstOrganicKind,
        firstOrganicDomain: String(body?.firstOrganicDomain ?? '').trim() || null,
        adCount: Number(body?.adCount) || 0,
        aiOverview: body?.aiOverview === true,
      });

  const db = admin();
  const { error } = await db.from('serp_observations').insert({
    niche_key: String(body?.nicheKey ?? '') || null,
    query: reading.query,
    location: reading.location,
    provider: 'human',
    checked_by: user.id,
    notes: String(body?.notes ?? '').trim() || null,
    pack_size: reading.packSize,
    ad_count: reading.adCount,
    ai_overview: reading.aiOverview,
    blocks_above: reading.blocksAbove,
    first_organic_domain: reading.firstOrganicDomain,
    first_organic_kind: reading.firstOrganicKind,
    first_organic_rank: reading.firstOrganicRank,
    verdict: reading.verdict,
    reason: reading.reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reading });
}
