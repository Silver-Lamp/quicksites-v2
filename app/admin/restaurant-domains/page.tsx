'use client';

// app/admin/restaurant-domains/page.tsx — "Restaurant Location Domains".
// One screen per restaurant apex (<city>-restaurant.com): the domain we own (or could
// buy), the contest running on it, the cohort competing, and the no-website restaurants
// in the area still available to pull into the claim-contest funnel. Actions: add a
// built restaurant to an existing contest, create a contest from ≥2 built candidates,
// copy each restaurant's funnel (claim) link. Data: /api/admin/restaurant-domains.
import * as React from 'react';
import Link from 'next/link';

type AreaRestaurant = {
  id: string;
  business_name: string;
  phone: string | null;
  address: string | null;
  status: string;
  template_id: string | null;
  published: boolean;
  site_url: string | null;
  claim_url: string | null;
  is_winner: boolean;
  waitlist_status: string | null;
};

type Area = {
  key: string;
  domain: string;
  domain_owned: boolean;
  domain_status: string | null;
  directory_url: string | null;
  city: string;
  region: string | null;
  campaign_id: string | null;
  campaign_status: string | null;
  has_winner: boolean;
  winner_name: string | null;
  competitors: AreaRestaurant[];
  candidates: AreaRestaurant[];
};

type Overview = {
  areas: Area[];
  totals: {
    domains_owned: number;
    contests: number;
    contests_decided: number;
    restaurants_competing: number;
    restaurants_available: number;
  };
};

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'emerald' | 'amber' | 'sky' | 'neutral' | 'purple'; children: React.ReactNode }) {
  const tones = {
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    purple: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
    neutral: 'border-neutral-700 bg-neutral-800/60 text-neutral-300',
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CopyLink({ url, label = 'Copy claim link' }: { url: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300 hover:border-neutral-500 hover:text-white"
      title={url}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

function RestaurantRow({ r, inContest }: { r: AreaRestaurant; inContest: boolean }) {
  return (
    <tr className="border-b border-neutral-800/60 last:border-0">
      <td className="py-1.5 pr-3">
        <span className="text-neutral-100">{r.business_name}</span>
        {r.is_winner && <span className="ml-2">🏆</span>}
      </td>
      <td className="py-1.5 pr-3 text-neutral-500">{r.phone || '—'}</td>
      <td className="py-1.5 pr-3">
        {r.is_winner ? (
          <Badge tone="emerald">winner</Badge>
        ) : r.waitlist_status === 'passed' ? (
          <Badge tone="neutral">passed</Badge>
        ) : r.status === 'claimed' ? (
          <Badge tone="emerald">claimed</Badge>
        ) : r.template_id ? (
          <Badge tone="sky">{r.published ? 'site live' : 'draft built'}</Badge>
        ) : (
          <Badge tone="amber">no site yet</Badge>
        )}
      </td>
      <td className="py-1.5 text-right">
        <span className="inline-flex items-center gap-1.5">
          {r.site_url && (
            <a
              href={r.site_url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-neutral-700 px-2 py-0.5 text-[11px] text-sky-300 hover:border-neutral-500"
            >
              View site ↗
            </a>
          )}
          {r.claim_url && !r.is_winner && r.status !== 'claimed' && (
            <CopyLink url={r.claim_url} label={inContest ? 'Copy contest link' : 'Copy claim link'} />
          )}
        </span>
      </td>
    </tr>
  );
}

export default function RestaurantDomainsPage() {
  const [data, setData] = React.useState<Overview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null); // area key while acting
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'failed');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Pull every built, un-linked candidate in the area into the existing contest.
  const addAllToContest = async (area: Area) => {
    const ids = area.candidates.filter((c) => c.template_id).map((c) => c.id);
    if (!area.campaign_id || !ids.length) return;
    setBusy(area.key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: area.campaign_id, prospectIds: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(`${json.linked.length} restaurant(s) added to the ${area.domain} contest.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  // Launch a contest from the area's built candidates (existing create endpoint; the
  // owned/derived apex is passed as the domain override).
  const createContest = async (area: Area) => {
    const ids = area.candidates.filter((c) => c.template_id).map((c) => c.id);
    if (ids.length < 2) return;
    if (!confirm(`Create the ${area.domain} contest with ${ids.length} restaurants? First to claim their site wins the domain.`)) return;
    setBusy(area.key);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/prospects/restaurant-competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: ids, domain: area.domain, region: area.region ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setNotice(`Contest created: ${json.domain} (${json.domainStatus}) — ${json.cohortSize} competing.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(null);
    }
  };

  const t = data?.totals;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Restaurant location domains</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Every <span className="text-neutral-200">&lt;city&gt;-restaurant.com</span> apex, the claim contest running
            on it, and the no-website restaurants in the area you can still pull into the funnel.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/admin/growth?tab=prospects" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
            Discover restaurants →
          </Link>
          <Link href="/admin/demand-funnel" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
            Demand funnel →
          </Link>
          <Link href="/admin/domains/costs" className="text-neutral-400 underline underline-offset-4 hover:text-neutral-200">
            Domain costs →
          </Link>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div>}

      {!data && !error && <div className="mt-8 text-sm text-neutral-500">Loading…</div>}

      {t && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Domains owned" value={String(t.domains_owned)} />
          <Kpi label="Contests" value={String(t.contests)} accent="text-sky-300" />
          <Kpi label="Decided (won)" value={String(t.contests_decided)} accent="text-emerald-300" />
          <Kpi label="Competing" value={String(t.restaurants_competing)} />
          <Kpi label="Available to add" value={String(t.restaurants_available)} accent="text-amber-300" />
        </div>
      )}

      <div className="mt-8 space-y-6">
        {data?.areas.map((area) => {
          const builtCandidates = area.candidates.filter((c) => c.template_id).length;
          return (
            <div key={area.key} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
              {/* Area header: domain + contest state */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {area.directory_url ? (
                    <a href={area.directory_url} target="_blank" rel="noreferrer" className="text-lg font-semibold text-white hover:underline">
                      {area.domain} ↗
                    </a>
                  ) : (
                    <span className="text-lg font-semibold text-white">{area.domain}</span>
                  )}
                  <span className="text-sm text-neutral-500">
                    {area.city}
                    {area.region ? `, ${area.region}` : ''}
                  </span>
                  {area.campaign_id ? (
                    area.has_winner ? (
                      <Badge tone="emerald">won by {area.winner_name || 'a claimant'}</Badge>
                    ) : (
                      <Badge tone="purple">contest live — first claim wins</Badge>
                    )
                  ) : area.domain_owned ? (
                    <Badge tone="sky">domain owned — no contest yet</Badge>
                  ) : (
                    <Badge tone="neutral">domain not owned</Badge>
                  )}
                  {area.domain_status && <Badge tone="neutral">{area.domain_status}</Badge>}
                </div>

                <div className="flex items-center gap-2">
                  {area.campaign_id && builtCandidates > 0 && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void addAllToContest(area)}
                      className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Adding…' : `Add ${builtCandidates} built to contest`}
                    </button>
                  )}
                  {!area.campaign_id && builtCandidates >= 2 && (
                    <button
                      type="button"
                      disabled={busy === area.key}
                      onClick={() => void createContest(area)}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {busy === area.key ? 'Creating…' : `Create contest (${builtCandidates} ready)`}
                    </button>
                  )}
                </div>
              </div>

              {/* Cohort in the contest */}
              {area.competitors.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    In the contest ({area.competitors.length})
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {area.competitors.map((r) => (
                        <RestaurantRow key={r.id} r={r} inContest />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Available restaurants in the area */}
              {area.candidates.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    No-website restaurants in {area.city} not yet in the funnel ({area.candidates.length})
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {area.candidates.map((r) => (
                        <RestaurantRow key={r.id} r={r} inContest={false} />
                      ))}
                    </tbody>
                  </table>
                  {builtCandidates < area.candidates.length && (
                    <p className="mt-2 text-xs text-neutral-500">
                      Restaurants without a site need a draft built first —{' '}
                      <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                        build them in the growth workspace →
                      </Link>
                    </p>
                  )}
                </div>
              )}

              {area.competitors.length === 0 && area.candidates.length === 0 && (
                <p className="mt-3 text-sm text-neutral-500">
                  No restaurants tracked in this area yet —{' '}
                  <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
                    run a discovery sweep →
                  </Link>
                </p>
              )}
            </div>
          );
        })}

        {data && data.areas.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center text-sm text-neutral-400">
            No restaurant domains or no-website restaurant prospects yet.{' '}
            <Link href="/admin/growth?tab=prospects" className="text-sky-400 hover:underline">
              Sweep a city for restaurants →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
