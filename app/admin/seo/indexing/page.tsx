// app/admin/seo/indexing/page.tsx
//
// Every page Search Console knows about on our connected properties, as the nightly URL Inspection
// sweep last saw it, grouped by what it MEANS for us (lib/gsc/indexingTriage.ts): fixable by us,
// needs a person, unclassified, expected, indexed. This is the page the Search Console emails
// point at in spirit and never in fact: it names the URLs and the canonical Google chose.
import { createClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';
import { BUCKET_LABEL, BUCKET_ORDER, type TriageBucket } from '@/lib/gsc/indexingTriage';
import GscInspectRun from '@/components/admin/gsc-inspect-run';

export const dynamic = 'force-dynamic';

type Row = {
  property: string;
  url: string;
  template_id: string | null;
  inspected_at: string;
  coverage_state: string | null;
  user_canonical: string | null;
  google_canonical: string | null;
  declared_canonical: string | null;
  last_crawl_time: string | null;
  bucket: TriageBucket;
  reason: string;
  remedy: string | null;
};

const BUCKET_CLASS: Record<TriageBucket, string> = {
  auto_fixable: 'text-amber-300',
  needs_person: 'text-rose-300',
  unknown: 'text-zinc-300',
  expected: 'text-sky-300',
  indexed: 'text-emerald-400',
};

export default async function IndexingPage() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
  const { data } = await db
    .from('gsc_url_inspections')
    .select('property, url, template_id, inspected_at, coverage_state, user_canonical, google_canonical, declared_canonical, last_crawl_time, bucket, reason, remedy')
    .order('inspected_at', { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as Row[];

  const byBucket = new Map<TriageBucket, Map<string, Row[]>>();
  for (const r of rows) {
    const b = byBucket.get(r.bucket) ?? new Map<string, Row[]>();
    const key = `${r.property.replace(/^sc-domain:/, '')} · ${r.reason}`;
    b.set(key, [...(b.get(key) ?? []), r]);
    byBucket.set(r.bucket, b);
  }
  const newest = rows[0]?.inspected_at ?? null;

  return (
    <div className="p-4 mt-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Indexing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length} URLs across connected Search Console properties, as the nightly URL Inspection sweep last saw them
              {newest ? ` (newest ${formatDistanceToNow(new Date(newest), { addSuffix: true })})` : ''}. Grouped by what each state means for us, not by Google&apos;s label.
            </p>
          </div>
          <GscInspectRun />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {BUCKET_ORDER.map((b) => (
            <span key={b} className={`rounded border border-border px-2 py-1 ${BUCKET_CLASS[b]}`}>
              {byBucket.get(b) ? [...byBucket.get(b)!.values()].reduce((n, l) => n + l.length, 0) : 0} {BUCKET_LABEL[b]}
            </span>
          ))}
        </div>

        {rows.length === 0 && (
          <p className="rounded border border-border bg-card p-4 text-sm text-muted-foreground">
            Nothing inspected yet. Run the sweep, or wait for tonight&apos;s cron.
          </p>
        )}

        {BUCKET_ORDER.map((bucket) => {
          const groups = byBucket.get(bucket);
          if (!groups?.size) return null;
          return (
            <section key={bucket} className="space-y-3">
              <h2 className={`text-lg font-semibold ${BUCKET_CLASS[bucket]}`}>{BUCKET_LABEL[bucket]}</h2>
              {[...groups.entries()].map(([key, list]) => (
                <details key={key} open={bucket === 'auto_fixable' || bucket === 'needs_person'} className="rounded-lg border border-border bg-card">
                  <summary className="cursor-pointer px-4 py-2 text-sm">
                    <span className="font-medium text-card-foreground">{key}</span>
                    <span className="ml-2 text-muted-foreground">{list.length} URL{list.length === 1 ? '' : 's'}</span>
                  </summary>
                  {list[0]?.remedy && <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{list[0].remedy}</p>}
                  <ul className="divide-y divide-border border-t border-border">
                    {list.map((r) => (
                      <li key={r.url} className="grid grid-cols-1 gap-1 px-4 py-2 text-xs md:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="truncate underline underline-offset-2 hover:text-foreground">{r.url}</a>
                          {r.google_canonical && !sameish(r.google_canonical, r.declared_canonical) && (
                            <div className="text-muted-foreground">Google canonical: <span className="font-mono">{r.google_canonical}</span> · we nominate <span className="font-mono">{r.declared_canonical ?? '—'}</span></div>
                          )}
                          {r.coverage_state && r.coverage_state !== r.reason && <div className="text-muted-foreground">Google: {r.coverage_state}</div>}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {r.last_crawl_time && <span title={r.last_crawl_time}>crawled {formatDistanceToNow(new Date(r.last_crawl_time), { addSuffix: true })}</span>}
                          <span title={r.inspected_at}>checked {formatDistanceToNow(new Date(r.inspected_at), { addSuffix: true })}</span>
                          {r.template_id && <a href={`/admin/templates/${r.template_id}`} className="underline underline-offset-2 hover:text-foreground">editor</a>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function sameish(a: string | null, b: string | null): boolean {
  const n = (s: string | null) => (s ?? '').toLowerCase().replace(/\/+$/, '');
  return !!a && n(a) === n(b);
}
