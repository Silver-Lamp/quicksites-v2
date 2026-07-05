// components/rebuild/rebuild-tool.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ensureGuestSession } from '@/lib/auth/guestSession';
import {
  DEFAULT_FEE_PCT,
  PARTNER_FEE_SHARE,
  estimatePartnerResidual,
} from '@/lib/commerce/partnerEarnings';

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );

type Summary = {
  businessName: string;
  industryLabel: string;
  services: string[];
  sourceUrl: string;
  heroImage: string | null;
};

// Staged status copy shown while the request is in flight (the real work is one
// server round-trip; these just make the ~10-20s wait feel like progress).
const STAGES = [
  'Reading their current site…',
  'Understanding the business…',
  'Writing fresh copy…',
  'Assembling the new site…',
];

/**
 * Public "AI rebuild" lead magnet: paste a client's existing site URL → mint a
 * guest session → POST /api/rebuild → drop into the editor with a working draft.
 * Doubles as a reseller sales demo ("watch us rebuild your client's site live").
 */
export default function RebuildTool({ initialUrl = '' }: { initialUrl?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ editorUrl: string; summary: Summary } | null>(null);
  const [gmv, setGmv] = useState(4000); // guessed monthly sales for the earnings overlay
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const normalizeUrl = (raw: string): string => {
    const t = raw.trim();
    if (!t) return '';
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setResult(null);

    const target = normalizeUrl(url);
    if (!target) {
      setError('Paste the web address of the site you want to rebuild.');
      return;
    }

    setLoading(true);
    setStage(0);
    stageTimer.current = setInterval(() => {
      setStage((s) => (s < STAGES.length - 1 ? s + 1 : s));
    }, 3500);

    try {
      const sess = await ensureGuestSession();
      if (!sess.user) {
        setError(sess.error || 'Could not start a free session. Sign in to rebuild instead.');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !json?.editorUrl) {
        setError(json?.error || 'Could not rebuild that site. Try another URL.');
        setLoading(false);
        return;
      }
      setResult({ editorUrl: json.editorUrl, summary: json.summary });
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setLoading(false);
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
    }
  };

  if (result) {
    const s = result.summary;
    return (
      <div className="mt-8 w-full max-w-2xl rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-10">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-400">Rebuilt ✓</p>
        <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{s.businessName}</h2>
        <p className="mt-1 text-zinc-400">
          {s.industryLabel} · rebuilt from{' '}
          <span className="text-zinc-300">{hostOf(s.sourceUrl)}</span>
        </p>
        {s.services?.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {s.services.slice(0, 6).map((svc, i) => (
              <li key={i} className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-300">
                {svc}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => router.push(result.editorUrl)}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-emerald-950 transition hover:opacity-90"
          >
            Open in the editor →
          </button>
          <button
            onClick={() => { setResult(null); setUrl(''); setLoading(false); }}
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
          >
            Rebuild another
          </button>
        </div>
        {/* "What you'd have earned" overlay — reselling this client on QuickSites,
            you keep a share of every order instead of a flat markup. */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            If you resold {s.businessName} on QuickSites
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label htmlFor="gmv" className="text-sm text-zinc-300">
              Their monthly sales
            </label>
            <span className="text-sm font-medium tabular-nums text-white">{money(gmv)}/mo</span>
          </div>
          <input
            id="gmv"
            type="range"
            min={0}
            max={50000}
            step={500}
            value={gmv}
            onChange={(e) => setGmv(Number(e.target.value))}
            className="mt-2 w-full accent-emerald-500"
          />
          {(() => {
            const est = estimatePartnerResidual({ monthlyGmv: gmv, feePct: DEFAULT_FEE_PCT });
            return (
              <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div>
                  <span className="text-3xl font-bold tabular-nums text-emerald-300">{money(est.monthly)}</span>
                  <span className="text-sm text-zinc-400">/mo to you</span>
                </div>
                <div className="text-sm text-zinc-400">
                  {money(est.annual)}/yr · {Math.round(PARTNER_FEE_SHARE * 100)}% of a{' '}
                  {(est.feePct * 100).toFixed(0)}% order fee — for the life of the account
                </div>
              </div>
            );
          })()}
          <p className="mt-3 text-xs text-zinc-500">
            A flat-fee builder pays you the same whether they sell $0 or {money(gmv)}.{' '}
            <Link href="/partners/calculator" className="text-emerald-400 underline-offset-2 hover:underline">
              Refine in the full calculator →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 w-full max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourclient.com"
          aria-label="Existing website URL"
          disabled={loading}
          className="flex-1 rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-4 text-lg text-white placeholder:text-zinc-500 focus:border-sky-400/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-semibold text-sky-950 shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Rebuilding…' : '✨ Rebuild it free'}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-sky-300" role="status" aria-live="polite">
          {STAGES[stage]}
        </p>
      )}
      {!loading && (
        <p className="mt-4 text-sm text-zinc-400">
          Paste any business website. We'll generate a fresh QuickSites draft from it in seconds —
          no credit card, sign up only when you're ready to go live.
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}
