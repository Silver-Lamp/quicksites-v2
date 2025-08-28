'use client';

import { useState } from 'react';
import Link from 'next/link';

type Result = {
  input: any;
  merchant_id?: string;
  customer_id?: string;
  subscription_id?: string | null;
  plan?: string | null;
  price_cents?: number | null;
  status:
    | 'created' | 'updated' | 'skipped_exists'
    | 'would_create' | 'would_update' | 'would_skip_exists'
    | 'not_found' | 'error';
  message?: string;
};

export default function PasteSyncPage() {
  const [text, setText] = useState('');
  const [syncFromStripe, setSyncFromStripe] = useState(false); // auto-off in dry run
  const [createOnly, setCreateOnly] = useState(true);
  const [dryRun, setDryRun] = useState(true);                  // <-- NEW: default preview mode
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(opts?: { dry?: boolean }) {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/billing/paste-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          syncFromStripe,
          createOnly,
          dryRun: typeof opts?.dry === 'boolean' ? opts.dry : dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setResults(json.results || []);
      setSummary(json.summary || null);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  const canApplyNow = !!results?.length && summary?.dryRun === true;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Paste Sync: Unmapped → Stripe Customer</h1>
        <div className="flex gap-2">
          <Link href="/admin/billing/map" className="rounded bg-neutral-900 px-3 py-2 text-sm ring-1 ring-neutral-800">Back to Billing Map</Link>
        </div>
      </div>

      <p className="mt-2 text-sm text-neutral-400">
        Paste lines like <code>email, customer_id</code> or <code>site_slug customer_id</code> or <code>merchant_id | customer_id</code>.
        Start with a <code>#</code> to comment out a line. <b>Dry run</b> previews with no writes.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <textarea
          value={text}
          onChange={(e)=>setText(e.target.value)}
          placeholder={`# examples
alex@example.com, cus_123
my-plumber-site  cus_456
3f7f5c0b-3d7b-4b5b-8f8c-c6b42c8b1d61 | cus_789`}
          className="min-h-[160px] w-full rounded-xl bg-neutral-950 p-3 text-sm ring-1 ring-neutral-800"
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e)=>setDryRun(e.target.checked)} />
            Dry run (no writes)
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createOnly} onChange={(e)=>setCreateOnly(e.target.checked)} />
            Create only (skip if mapping already exists)
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={syncFromStripe}
              onChange={(e)=>setSyncFromStripe(e.target.checked)}
              disabled={dryRun}
              title={dryRun ? 'Stripe sync runs only on real runs' : undefined}
            />
            Sync plan/price/subscription from Stripe
          </label>

          <button
            onClick={()=>run()}
            disabled={loading || !text.trim()}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Running…' : dryRun ? 'Preview (Dry Run)' : 'Run'}
          </button>

          {canApplyNow && (
            <button
              onClick={()=>run({ dry: false })}
              disabled={loading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
              title="Re-run the same paste with writes enabled"
            >
              Apply now
            </button>
          )}
        </div>
      </div>

      {error && <div className="mt-4 rounded bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Total" value={summary.total} />
          {summary.dryRun ? (
            <>
              <Stat label="Would create" value={summary.would_create} />
              <Stat label="Would update" value={summary.would_update} />
              <Stat label="Would skip (exists)" value={summary.would_skip_exists} />
            </>
          ) : (
            <>
              <Stat label="Created" value={summary.created} />
              <Stat label="Updated" value={summary.updated} />
              <Stat label="Skipped (exists)" value={summary.skipped_exists} />
            </>
          )}
          <Stat label="Not found" value={summary.not_found} />
          <Stat label="Errors" value={summary.error} />
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-800">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-900">
              <tr className="[&>th]:px-4 [&>th]:py-3 text-left">
                <th>Input</th>
                <th>Merchant</th>
                <th>Customer</th>
                <th>Subscription</th>
                <th>Plan</th>
                <th>Price</th>
                <th>Status</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {results.map((r, i) => (
                <tr key={i} className="[&>td]:px-4 [&>td]:py-3">
                  <td className="text-xs">{formatInput(r.input)}</td>
                  <td className="font-mono text-xs">{r.merchant_id ? r.merchant_id.slice(0,8)+'…' : '—'}</td>
                  <td className="font-mono text-xs">{r.customer_id || '—'}</td>
                  <td className="font-mono text-xs">{r.subscription_id || '—'}</td>
                  <td className="text-xs">{r.plan || '—'}</td>
                  <td className="text-xs">{typeof r.price_cents === 'number' ? `$${(r.price_cents/100).toFixed(2)}` : '—'}</td>
                  <td className="text-xs">
                    <span className="rounded bg-neutral-800 px-2 py-1">
                      {r.status}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-400">{r.message || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatInput(inp: any) {
  if (typeof inp === 'string') return inp;
  if (!inp) return '';
  if (inp.email) return `${inp.email}`;
  if (inp.site_slug) return `/${inp.site_slug}`;
  if (inp.merchant_id) return inp.merchant_id;
  return JSON.stringify(inp);
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value ?? 0}</div>
    </div>
  );
}
