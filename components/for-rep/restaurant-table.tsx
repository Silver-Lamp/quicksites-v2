'use client';

// components/for-rep/restaurant-table.tsx
//
// The rep's restaurant list for businesses that HAVE a website: who takes online orders and
// through whom (read from their own site), with "Build their ordering page" on the rows where
// nothing was found. The build runs /api/rep/build-draft in mode 'from_site', so the draft is
// their published menu, not a guess — and the text message says their site stays as it is.
import * as React from 'react';
import { repOrderingSmsDraft, smsHref } from '@/lib/rep/repBuild';

export type RestaurantTableRow = {
  prospectId: string;
  businessName: string;
  phone: string | null;
  websiteHost: string;
  /** Human label: "Toast", "no online ordering found", "not checked". */
  platformLabel: string;
  /** 'call' rows get the build button; the others are shown for the rep's notes. */
  group: 'call' | 'shop' | 'siteOnly' | 'thirdParty' | 'leaveAlone' | 'unchecked';
  rating: number | null;
  reviewCount: number | null;
  previewUrl: string | null;
  claimUrl: string | null;
  evolveUrl?: string | null;
};

type Built = { previewUrl: string; claimUrl: string; evolveUrl?: string | null; menuItems?: number; menuSource?: string; droppedItems?: number; droppedPrices?: number; alreadyBuilt?: boolean };

const GROUP_TAG: Record<RestaurantTableRow['group'], { text: string; cls: string }> = {
  call: { text: 'call first', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  shop: { text: 'shop, no food ordering', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  siteOnly: { text: 'site only', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  thirdParty: { text: 'app only', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  leaveAlone: { text: 'leave alone', cls: 'border-zinc-700 bg-zinc-800 text-zinc-400' },
  unchecked: { text: 'not checked', cls: 'border-zinc-700 bg-zinc-800 text-zinc-500' },
};

export default function RestaurantTable({ rows, token, repName }: { rows: RestaurantTableRow[]; token: string; repName: string }) {
  const [built, setBuilt] = React.useState<Record<string, Built>>(() =>
    Object.fromEntries(rows.filter((r) => r.previewUrl && r.claimUrl).map((r) => [r.prospectId, { previewUrl: r.previewUrl!, claimUrl: r.claimUrl!, evolveUrl: r.evolveUrl ?? null, alreadyBuilt: true }])),
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState<string | null>(null);

  async function build(r: RestaurantTableRow) {
    setBusy(r.prospectId);
    setErrors((e) => ({ ...e, [r.prospectId]: '' }));
    try {
      const res = await fetch('/api/rep/build-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, prospectId: r.prospectId, mode: 'from_site' }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        const why =
          j?.error === 'daily_cap' ? `That's today's limit (${j.limit} builds a day). Try again tomorrow.`
          : j?.error === 'bad_token' ? 'This page link has expired — ask Sandon for a fresh one.'
          : j?.error === 'scrape_failed' ? "Couldn't read their site just now. Try once more; if it sticks, build from the listing instead."
          : j?.error === 'ai_failed' ? 'The menu reader is busy — try again in a minute.'
          : `Couldn't build it (${j?.error ?? res.status}). Try once more; if it sticks, tell Sandon.`;
        setErrors((e) => ({ ...e, [r.prospectId]: why }));
        return;
      }
      setBuilt((b) => ({ ...b, [r.prospectId]: { previewUrl: j.previewUrl, claimUrl: j.claimUrl, evolveUrl: j.evolveUrl ?? null, menuItems: j.menuItems, menuSource: j.menuSource, droppedItems: j.droppedItems, droppedPrices: j.droppedPrices, alreadyBuilt: !!j.alreadyBuilt } }));
    } catch {
      setErrors((e) => ({ ...e, [r.prospectId]: 'Network hiccup — try again.' }));
    } finally {
      setBusy(null);
    }
  }

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* the link is visible on the row */
    }
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Restaurant</th>
            <th className="px-3 py-2">Their site</th>
            <th className="px-3 py-2">Online orders</th>
            <th className="px-3 py-2 text-right">Google</th>
            <th className="px-3 py-2 text-right">Ordering page</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const b = built[r.prospectId];
            const err = errors[r.prospectId];
            const tag = GROUP_TAG[r.group];
            const sms = b ? smsHref(r.phone, repOrderingSmsDraft({ repName, businessName: r.businessName, previewUrl: b.previewUrl })) : null;
            return (
              <React.Fragment key={r.prospectId}>
                <tr className="border-t border-zinc-800/80">
                  <td className="px-3 py-2 font-medium text-zinc-100">
                    {r.businessName}
                    {r.phone && (
                      <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className="ml-2 text-xs font-normal text-zinc-400 hover:underline">{r.phone}</a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{r.websiteHost}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tag.cls}`}>{tag.text}</span>
                    <span className="ml-2 text-xs text-zinc-400">{r.platformLabel}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
                    {typeof r.rating === 'number' && r.rating > 0 ? `${r.rating}★ · ${r.reviewCount ?? 0}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {b ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">built</span>
                    ) : r.group === 'call' || r.group === 'thirdParty' || r.group === 'shop' ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => build(r)}
                        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {busy === r.prospectId ? 'Reading their menu…' : 'Build their ordering page'}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
                {(b || err) && (
                  <tr className="border-t border-zinc-800/40 bg-zinc-900/30">
                    <td colSpan={5} className="px-3 py-2 text-xs text-zinc-400">
                      {err ? (
                        <span className="text-rose-300">{err}</span>
                      ) : b ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <a href={b.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">Open it →</a>
                          {b.evolveUrl && (
                            <a href={b.evolveUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">Evolve page (show this) →</a>
                          )}
                          <button type="button" onClick={() => copy(r.prospectId, b.claimUrl)} className="text-zinc-200 hover:underline">
                            {copied === r.prospectId ? 'Copied' : 'Copy claim link'}
                          </button>
                          {sms && r.phone && <a href={sms} className="text-zinc-200 hover:underline">Text them</a>}
                          {b.menuSource === 'site' && (
                            <span className="text-emerald-300/90">
                              Menu read from their own site{typeof b.menuItems === 'number' ? ` — ${b.menuItems} items` : ''}.
                              {b.droppedItems ? ` ${b.droppedItems} the site didn't confirm were left out.` : ''}
                              {b.droppedPrices ? ` ${b.droppedPrices} kept without a price.` : ''}
                              {' '}Check the prices with them.
                            </span>
                          )}
                          {b.menuSource === 'none' && <span className="text-amber-300/90">Their site showed no readable menu — add it with them.</span>}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
