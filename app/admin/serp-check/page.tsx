// app/admin/serp-check/page.tsx
//
// The operator surface for docs/SERP_CHECK_WORKSHEET.md — a person walks the searches, the
// server scores each one with the same rule the API path uses, and the run reports where the two
// disagreed. Admin-gated; the client shell does the stepping.
//
// ⚠️ Server component. Everything interactive lives in serp-check-client.tsx — an inline handler
// here is a runtime crash, not a lint warning (see /admin/referrals, which shipped that way and
// died the week its table had rows).

import { getAdminUser } from '@/lib/auth/getAdminUser';
import { NICHE_CANDIDATES } from '@/lib/niches/candidates';
import { nicheWorklist, worksheetWorklist, type WorklistStep } from '@/lib/serp/worklist';
import { createClient } from '@supabase/supabase-js';
import SerpCheckClient from '@/components/admin/serp-check-client';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'SERP check' };

export default async function SerpCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string; cities?: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const sp = await searchParams;
  let steps: WorklistStep[] = [];
  let error: string | null = null;
  try {
    if (sp.niche) {
      const c = NICHE_CANDIDATES.find((x) => x.key === sp.niche);
      if (!c) throw new Error(`No candidate "${sp.niche}"`);
      const cities = (sp.cities ?? 'Austin').split(',').map((s) => s.trim()).filter(Boolean);
      steps = nicheWorklist(c.key, c.queries, cities);
    } else {
      steps = worksheetWorklist();
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not build that run';
    steps = [];
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
  const { data: rows } = steps.length
    ? await db
        .from('serp_observations')
        .select('query, location, provider, pack_size, first_organic_kind, first_organic_domain, verdict, reason, checked_at, notes')
        .in('query', steps.map((s) => s.query))
        .order('checked_at', { ascending: false })
    : { data: [] as any[] };

  const key = (q: string, l: string) => `${q}|${l}`;
  const human = new Map<string, any>();
  const machine = new Map<string, any>();
  for (const r of rows ?? []) {
    const m = r.provider === 'human' ? human : machine;
    if (!m.has(key(r.query, r.location))) m.set(key(r.query, r.location), r);
  }

  const initialRows = steps.map((s) => ({
    index: s.index,
    nicheKey: s.nicheKey,
    query: s.query,
    location: s.location,
    isControl: s.isControl,
    searchUrl: s.searchUrl,
    needsLocationOverride: s.needsLocationOverride,
    coords: s.coords,
    human: human.get(key(s.query, s.location)) ?? null,
    machine: machine.get(key(s.query, s.location)) ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-100">SERP check</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          Twenty minutes of searching that decides whether a niche is worth buying domains for. You
          are answering one question per search: <strong className="text-neutral-200">how many
          businesses are in the map pack</strong>. The scoring happens server-side with the same
          rule the automated runs use, so where you disagree, the tool gets fixed.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/admin/serp-check" className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-300 hover:border-neutral-500">
            The worksheet set
          </Link>
          {NICHE_CANDIDATES.filter((c) => c.key !== 'towing').slice(0, 6).map((c) => (
            <Link key={c.key} href={`/admin/serp-check?niche=${c.key}&cities=Austin,Denver`}
              className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-300 hover:border-neutral-500">
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      ) : (
        <SerpCheckClient initialRows={initialRows} />
      )}
    </div>
  );
}
