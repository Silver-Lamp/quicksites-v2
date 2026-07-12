'use client';

// Unified "Growth" workspace — one home for the whole lead-gen → outreach funnel, replacing
// the old scattered Growth nav items. Tabs render the existing surfaces (passed as nodes from
// the server page); both stay mounted (CSS-hidden when inactive) so the Businesses-Near-Me
// map + state survive a tab switch. Deep-linkable via ?tab=prospects|pipeline.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type TabKey = 'prospects' | 'pipeline';

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'prospects', label: 'Businesses Near Me', hint: 'Sweep, score, and pitch local businesses' },
  { key: 'pipeline', label: 'Outreach Pipeline', hint: 'Auto-built draft sites + claim status' },
];

export default function GrowthWorkspace({
  prospects,
  pipeline,
  counts,
}: {
  prospects: ReactNode;
  pipeline: ReactNode;
  counts?: { prospects?: number; pipeline?: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = (params.get('tab') as TabKey) || 'prospects';
  const [tab, setTab] = useState<TabKey>(initial === 'pipeline' ? 'pipeline' : 'prospects');

  // Keep state in sync if the query changes (e.g. a nav deep-link click).
  useEffect(() => {
    const t = params.get('tab');
    if (t === 'pipeline' || t === 'prospects') setTab(t);
  }, [params]);

  const select = useCallback(
    (t: TabKey) => {
      setTab(t);
      const q = new URLSearchParams(params.toString());
      q.set('tab', t);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="text-white">
      {/* Slim workspace bar — the tab content carries its own title below. */}
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Growth</div>
        <div className="mt-2 flex gap-1 border-b border-neutral-800">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts?.[t.key];
            return (
              <button
                key={t.key}
                onClick={() => select(t.key)}
                title={t.hint}
                className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition ${
                  active ? 'border-fuchsia-400 text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t.label}
                {typeof count === 'number' && (
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-fuchsia-500/20 text-fuchsia-200' : 'bg-neutral-800 text-neutral-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Both mounted; inactive one hidden so the Businesses-Near-Me map/state persist. */}
      <div className={tab === 'prospects' ? '' : 'hidden'}>{prospects}</div>
      <div className={tab === 'pipeline' ? '' : 'hidden'}>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Outreach pipeline</h1>
              <p className="mt-1 text-sm text-neutral-400">Auto-built restaurant sites from the listing importer. Send the claim link; they preview, sign up, and own it.</p>
            </div>
            <a href="/restaurants" className="text-sm text-amber-300 underline underline-offset-4 hover:text-amber-200">The offer →</a>
          </div>
          <div className="mt-6">{pipeline}</div>
        </div>
      </div>
    </div>
  );
}
