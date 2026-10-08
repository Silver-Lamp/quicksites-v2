'use client';

// components/for-rep/no-site-table.tsx
//
// The rep's working list: every swept business in their territory with no website, each with
// a one-click "Build their site". The build runs through /api/rep/build-draft on the grant the
// page minted; the row then shows the preview, the claim link and a prefilled text message —
// the three things a rep needs standing in the doorway.
import * as React from 'react';
import { repSmsDraft, smsHref } from '@/lib/rep/repBuild';

export type NoSiteRow = {
  prospectId: string;
  businessName: string;
  trade: string;
  phone: string | null;
  street: string;
  rating: number | null;
  reviewCount: number | null;
  /** Set when a draft already exists — the row opens with its links. */
  previewUrl: string | null;
  claimUrl: string | null;
};

type Built = { previewUrl: string; claimUrl: string; menuSource?: string; alreadyBuilt?: boolean };

export default function NoSiteTable({ rows, token, repName }: { rows: NoSiteRow[]; token: string; repName: string }) {
  const [built, setBuilt] = React.useState<Record<string, Built>>(() =>
    Object.fromEntries(rows.filter((r) => r.previewUrl && r.claimUrl).map((r) => [r.prospectId, { previewUrl: r.previewUrl!, claimUrl: r.claimUrl!, alreadyBuilt: true }])),
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState<string | null>(null);

  async function build(r: NoSiteRow) {
    setBusy(r.prospectId);
    setErrors((e) => ({ ...e, [r.prospectId]: '' }));
    try {
      const res = await fetch('/api/rep/build-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, prospectId: r.prospectId }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        const why = j?.error === 'daily_cap' ? `That's today's limit (${j.limit} builds a day). Try again tomorrow.` : j?.error === 'bad_token' ? 'This page link has expired — ask Sandon for a fresh one.' : `Couldn't build it (${j?.error ?? res.status}). Try once more; if it sticks, tell Sandon.`;
        setErrors((e) => ({ ...e, [r.prospectId]: why }));
        return;
      }
      setBuilt((b) => ({ ...b, [r.prospectId]: { previewUrl: j.previewUrl, claimUrl: j.claimUrl, menuSource: j.menuSource, alreadyBuilt: !!j.alreadyBuilt } }));
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
      /* the link is visible on the row; nothing to do */
    }
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Trade</th>
            <th className="px-3 py-2">Business</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Street</th>
            <th className="px-3 py-2 text-right">Google</th>
            <th className="px-3 py-2 text-right">Their site</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const b = built[r.prospectId];
            const err = errors[r.prospectId];
            const sms = b ? smsHref(r.phone, repSmsDraft({ repName, businessName: r.businessName, previewUrl: b.previewUrl })) : null;
            return (
              <React.Fragment key={r.prospectId}>
                <tr className="border-t border-zinc-800/80">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{r.trade}</td>
                  <td className="px-3 py-2 font-medium text-zinc-100">{r.businessName}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                    {r.phone ? <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`} className="hover:underline">{r.phone}</a> : '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{r.street}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">
                    {typeof r.rating === 'number' && r.rating > 0 ? `${r.rating}★ · ${r.reviewCount ?? 0}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {b ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">built</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => build(r)}
                        className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {busy === r.prospectId ? 'Building…' : 'Build their site'}
                      </button>
                    )}
                  </td>
                </tr>
                {(b || err) && (
                  <tr className="border-t border-zinc-800/40 bg-zinc-900/30">
                    <td colSpan={6} className="px-3 py-2 text-xs text-zinc-400">
                      {err ? (
                        <span className="text-rose-300">{err}</span>
                      ) : b ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <a href={b.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">Open it →</a>
                          <button type="button" onClick={() => copy(r.prospectId, b.claimUrl)} className="text-zinc-200 hover:underline">
                            {copied === r.prospectId ? 'Copied' : 'Copy claim link'}
                          </button>
                          {sms && r.phone && (
                            <a href={sms} className="text-zinc-200 hover:underline">Text them</a>
                          )}
                          {b.menuSource === 'none' && <span className="text-amber-300/90">No menu found on their listing — add it with them.</span>}
                          {b.menuSource === 'auto' && <span className="text-emerald-300/90">Menu read from their photos — check the prices with them.</span>}
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
