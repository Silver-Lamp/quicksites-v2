'use client';

// components/admin/auto-shop-domains-client.tsx
//
// The auto-shop competition cockpit. Lists live <city>-auto-repair.com competitions (cohort
// + first-to-claim winner + directory link) and candidate cities (no-website auto shops not
// yet in a competition) from which to launch a new one (needs 2+ shops with a built site).

import * as React from 'react';
import type { AutoShopArea, AutoShopCandidateCity } from '@/lib/outreach/autoShopDomains';

type Cockpit = {
  areas: AutoShopArea[];
  candidateCities: AutoShopCandidateCity[];
  kpis: { competitions: number; claimed: number; candidateCities: number };
};

export default function AutoShopDomainsClient() {
  const [data, setData] = React.useState<Cockpit | null>(null);
  const [auth, setAuth] = React.useState<'loading' | 'ok' | 'forbidden'>('loading');
  const [busy, setBusy] = React.useState<string>('');
  const [msg, setMsg] = React.useState('');

  const load = React.useCallback(async () => {
    const res = await fetch('/api/admin/auto-shop-domains');
    if (res.status === 403) return setAuth('forbidden');
    const d = await res.json();
    setData({ areas: d.areas ?? [], candidateCities: d.candidateCities ?? [], kpis: d.kpis ?? { competitions: 0, claimed: 0, candidateCities: 0 } });
    setAuth('ok');
  }, []);
  React.useEffect(() => { load().catch(() => setAuth('forbidden')); }, [load]);

  async function createCompetition(city: AutoShopCandidateCity) {
    const prospectIds = city.shops.filter((s) => s.built).map((s) => s.prospectId);
    if (prospectIds.length < 2) return;
    setBusy(city.city); setMsg('');
    try {
      const res = await fetch('/api/admin/prospects/auto-shop-competition', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prospectIds }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Create failed');
      setMsg(`Launched ${d.domain} (${d.cohortSize} shops).`);
      await load();
    } catch (e: any) { setMsg(e?.message || 'Create failed'); } finally { setBusy(''); }
  }

  if (auth === 'loading') return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (auth === 'forbidden') return <p className="text-sm text-red-500">Forbidden — platform admin only.</p>;
  if (!data) return <p className="text-sm text-red-500">Could not load.</p>;

  return (
    <div className="space-y-8">
      <div className="flex gap-6 text-sm">
        <div><span className="text-2xl font-semibold">{data.kpis.competitions}</span><div className="text-muted-foreground">competitions</div></div>
        <div><span className="text-2xl font-semibold">{data.kpis.claimed}</span><div className="text-muted-foreground">claimed</div></div>
        <div><span className="text-2xl font-semibold">{data.kpis.candidateCities}</span><div className="text-muted-foreground">candidate cities</div></div>
      </div>
      {msg ? <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">{msg}</p> : null}

      {/* Live competitions */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">Competitions</h2>
        {data.areas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet — launch one from a candidate city below.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.areas.map((a) => (
              <div key={a.campaignId} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <a href={a.directoryUrl} target="_blank" rel="noreferrer" className="font-mono text-sm font-semibold text-primary underline">{a.domain}</a>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}{a.domainStatus ? ` · ${a.domainStatus}` : ''}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{[a.city, a.region].filter(Boolean).join(', ')} · {a.competitors.length} shops{a.hasWinner ? ' · winner claimed' : ''}</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {a.competitors.map((c) => (
                    <li key={c.prospectId} className="flex items-center gap-2">
                      <span className={c.isWinner ? 'text-emerald-600' : ''}>{c.isWinner ? '★ ' : ''}{c.businessName}</span>
                      {c.published ? <span className="text-xs text-emerald-600">live</span> : c.templateId ? <span className="text-xs text-muted-foreground">built</span> : <span className="text-xs text-amber-600">no site</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Candidate cities → launch */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">Candidate cities (no-website auto shops)</h2>
        {data.candidateCities.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No candidate cities — discover no-website auto shops in <a className="underline" href="/admin/growth?tab=prospects">Growth</a>.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.candidateCities.map((city) => (
              <div key={`${city.city}-${city.region}`} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">{[city.city, city.region].filter(Boolean).join(', ')}</div>
                  <button
                    type="button"
                    disabled={busy === city.city || city.builtCount < 2}
                    onClick={() => createCompetition(city)}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                    title={city.builtCount < 2 ? 'Build 2+ shop sites first (in Growth)' : 'Launch the competition'}
                  >
                    {busy === city.city ? 'Launching…' : `Launch (${city.builtCount} built)`}
                  </button>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{city.shops.length} shops · {city.builtCount} with a built site</div>
                {city.builtCount < 2 ? <div className="mt-1 text-xs text-amber-600">Build 2+ sites in Growth before launching.</div> : null}
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {city.shops.slice(0, 12).map((s) => (
                    <li key={s.prospectId}>{s.built ? '✓ ' : '· '}{s.businessName}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
