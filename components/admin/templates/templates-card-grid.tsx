'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Copy, ExternalLink, Pencil, CheckCircle2, CircleDashed, Sparkles } from 'lucide-react';
import { prettifySlug } from '@/lib/home/showcase-helpers';

type Row = {
  id: string;
  slug: string;
  template_name?: string | null;
  display_name?: string | null;
  industry?: string | null;
  industry_label?: string | null;
  published?: boolean | null;
  is_site?: boolean | null;
  updated_at?: string | null;
  banner_url?: string | null;
  domain?: string | null;
  custom_domain?: string | null;
  data?: any;
};

// Use the generated OG thumbnail (reads each template's OWN data — hero image or
// a themed accent card). `v` busts the CDN cache when the site changes. Falls back
// to a lettered card only if the route itself errors.
function CardThumb({ slug, name, version }: { slug: string; name: string; version?: string | null }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <Placeholder name={name} />;
  const v = version ? `?v=${encodeURIComponent(version)}` : '';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/public/showcase/${encodeURIComponent(slug)}/thumb${v}`}
      alt={name}
      loading="lazy"
      onError={() => setOk(false)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
    />
  );
}

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-3xl font-bold text-zinc-600">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function liveHref(r: Row): string | null {
  const dom = (r.custom_domain || r.domain || '').trim();
  if (dom) return `https://${dom.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return r.published ? `/sites/${r.slug}` : null;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return '';
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  const units: [number, string][] = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.348, 'week'], [12, 'month'], [Number.MAX_SAFE_INTEGER, 'year'],
  ];
  let v = s; let i = 0;
  for (; i < units.length && v >= units[i][0]; i++) v = Math.floor(v / units[i][0]);
  const label = units[i]?.[1] ?? 'second';
  return `${v} ${label}${v === 1 ? '' : 's'} ago`;
}

function ShimmerCard({ label }: { label?: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="aspect-[16/10] w-full animate-pulse bg-zinc-800/70" />
      <div className="space-y-2 p-4">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-800" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-800/70" />
        {label ? (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-sky-400/80">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> {label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Skeleton grid shown while the first page is loading (no rows yet). */
export function TemplatesCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <ShimmerCard key={`skeleton-${i}`} />
      ))}
    </div>
  );
}

export default function TemplatesCardGrid({
  rows,
  pending = 0,
  loading = false,
}: {
  rows: Row[];
  pending?: number;
  loading?: boolean;
}) {
  const router = useRouter();
  const [dupBusy, setDupBusy] = useState<string | null>(null);

  if (!rows?.length && pending <= 0) {
    // First load (no rows yet) → skeleton instead of a flash of "No templates yet."
    if (loading) return <TemplatesCardGridSkeleton />;
    return <div className="py-16 text-center text-sm text-zinc-500">No templates yet.</div>;
  }

  async function duplicate(slug: string) {
    if (dupBusy) return;
    setDupBusy(slug);
    try {
      const res = await fetch(`/api/templates/duplicate?slug=${encodeURIComponent(slug)}`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.id) throw new Error(j?.error || 'Duplicate failed');
      toast.success('Template duplicated');
      router.push(`/admin/templates/${j.id}/edit`);
    } catch (e: any) {
      toast.error(e?.message || 'Duplicate failed');
      setDupBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: Math.max(0, pending) }).map((_, i) => (
        <ShimmerCard key={`pending-${i}`} label="Generating…" />
      ))}
      {rows.map((r) => {
        const name = r.display_name || r.template_name || prettifySlug(r.slug);
        const industry = r.industry_label || r.industry || null;
        const live = liveHref(r);
        const published = !!r.published;

        return (
          <div
            key={r.id || r.slug}
            className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-600"
          >
            <Link href={`/admin/templates/${r.slug}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-zinc-800/60">
              <CardThumb slug={r.slug} name={name} version={r.updated_at} />
              <span
                className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur ${
                  published ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-950/70 text-zinc-300'
                }`}
              >
                {published ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                {published ? 'Published' : 'Draft'}
              </span>
            </Link>

            <div className="flex flex-1 flex-col p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                  {industry ? <span className="truncate">{industry}</span> : <span className="text-zinc-600">No industry</span>}
                  <span className="text-zinc-700">·</span>
                  <span>{timeAgo(r.updated_at)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/admin/templates/${r.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button
                  onClick={() => duplicate(r.slug)}
                  disabled={dupBusy === r.slug}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  <Copy className="h-3.5 w-3.5" /> {dupBusy === r.slug ? 'Duplicating…' : 'Duplicate'}
                </button>
                {live ? (
                  <a
                    href={live}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-sky-400 transition hover:text-sky-300"
                  >
                    View live <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
