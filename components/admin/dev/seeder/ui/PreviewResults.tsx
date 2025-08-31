'use client';

import * as React from 'react';
import type { SeedResult } from '../types';
import { Button } from '@/components/ui/button';
import { Loader, Save, X, Copy } from 'lucide-react';

function dollars(n?: number) {
  return typeof n === 'number' && isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

export function PreviewResults({
  res,
  pending,
  onSave,
  onClear,
}: {
  res: SeedResult | null;
  pending: boolean;
  onSave: () => void;
  onClear: () => void;
}) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(8);

  React.useEffect(() => setPage(1), [res?.products?.items?.length]);

  if (!res) return null;

  const isPreview = res.mode === 'preview';

  // Brand + merchant visuals
  const brand = (res.merchant as any)?.preview?.brand ?? null;
  const merchantLogo =
    (res.merchant as any)?.preview?.logo_data_url ||
    (res.merchant as any)?.preview?.logo_url ||
    (res.merchant as any)?.logo_url ||
    null;

  // Template shapes
  const tplPreview = (res.template as any)?.preview ?? null;
  const tplSaved: null | { template_id: string; name?: string; slug?: string } =
    res.template && 'template_id' in (res.template as any) ? (res.template as any) : null;

  // Products
  const items = res.products?.items ?? [];
  const total = items.length;
  const start = Math.min((page - 1) * pageSize, Math.max(0, total - 1));
  const end = Math.min(start + pageSize, total);
  const slice = items.slice(start, end);

  const canPrev = page > 1;
  const canNext = end < total;

  // Not a hook: safe in dev HMR
  function copyToClipboard(text: string) {
    try {
      navigator?.clipboard?.writeText(text);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-xl border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Preview Results</div>
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium">{res.mode}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {isPreview && (
            <Button onClick={onSave} disabled={pending} title="Save these results to the database">
              {pending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save These to DB
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={onClear}
            disabled={pending}
            title="Clear preview from this panel"
          >
            <X className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      {/* Merchant header */}
      <div className="rounded-lg border p-3 flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 rounded-md border overflow-hidden bg-muted grid place-items-center">
          {merchantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={merchantLogo} alt="logo" className="h-full w-full object-cover" />
          ) : (
            <div className="text-[10px] text-muted-foreground px-2 text-center leading-tight">
              {isPreview ? 'logo generating…' : 'no logo'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {brand?.name ?? (res.merchant as any)?.name ?? 'Merchant'}
          </div>
          {brand?.tagline && (
            <div className="text-xs text-muted-foreground truncate">{brand.tagline}</div>
          )}
          {(brand?.city || brand?.state) && (
            <div className="text-[11px] text-muted-foreground">
              {[brand?.city, brand?.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Template summary (preview) */}
      {tplPreview && (
        <div className="rounded-md border p-2 text-xs">
          <div className="font-medium">Template Preview</div>
          <div>Name: {tplPreview.name || '—'}</div>
          <div>Slug: {tplPreview.slug || '—'}</div>
          <div>Pages: {tplPreview.data?.pages?.length ?? 0}</div>
        </div>
      )}

      {/* Template summary (saved) */}
      {tplSaved && res.mode === 'saved' && (
        <div className="rounded-md border p-2 text-xs space-y-1">
          <div className="font-medium">Template (saved)</div>
          <div className="flex items-center gap-2">
            <span>Template ID:</span>
            <span className="font-mono">{tplSaved.template_id}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 py-0"
              onClick={() => copyToClipboard(tplSaved.template_id)}
              title="Copy template ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div>Name: {tplSaved.name ?? tplPreview?.name ?? '—'}</div>
          <div>Slug: {tplSaved.slug ?? tplPreview?.slug ?? '—'}</div>
          <div className="pt-1">
            <a
              href={`/template/${tplSaved.template_id}/edit`}
              className="inline-block rounded border px-2 py-1 hover:bg-muted transition"
            >
              Open in Editor
            </a>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-medium">{total ? start + 1 : 0}</span>–
          <span className="font-medium">{end}</span> of{' '}
          <span className="font-medium">{total}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs">Page size</label>
          <select
            className="rounded-md border px-2 py-1 text-xs bg-background"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value || '8', 10));
              setPage(1);
            }}
          >
            {[4, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" disabled={!canPrev} onClick={() => setPage(1)}>
              «
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!canNext}
              onClick={() => setPage(Math.ceil(total / pageSize) || 1)}
            >
              »
            </Button>
          </div>
        </div>
      </div>

      {/* Products grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {slice.map((p, i) => {
          const anyP = p as any;
          const src = anyP.image_data_url || anyP.image_url || null;
          return (
            <div key={`${anyP.title ?? 'item'}-${start + i}`} className="rounded-lg border overflow-hidden bg-background">
              <div className="h-36 w-full bg-muted grid place-items-center overflow-hidden">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(45deg,_rgba(0,0,0,0.06)_25%,_transparent_25%,_transparent_50%,_rgba(0,0,0,0.06)_50%,_rgba(0,0,0,0.06)_75%,_transparent_75%,_transparent_100%)] bg-[length:24px_24px] grid place-items-center text-[10px] text-muted-foreground">
                    image generating…
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium truncate">{anyP.title || 'Untitled'}</div>
                  <div className="text-xs rounded-full border px-2 py-0.5 shrink-0">{dollars(anyP.price_usd)}</div>
                </div>
                <div className="text-[11px] text-muted-foreground">{anyP.type || '—'}</div>
                {anyP.blurb && (
                  <div className="text-[11px] text-muted-foreground line-clamp-3">{anyP.blurb}</div>
                )}
              </div>
            </div>
          );
        })}
        {!slice.length && (
          <div className="col-span-full text-xs text-muted-foreground">No products to preview.</div>
        )}
      </div>

      {/* Published template (after save) */}
      {res.site?.ok && res.mode === 'saved' && (
        <div className="rounded-md border p-2 text-xs">
          <div className="font-medium">Published Template</div>
          <div>
            Default subdomain: <span className="font-mono">{res.site.slug}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            This is the canonical template’s default subdomain. It points to the saved version.
          </p>
        </div>
      )}

      {isPreview && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          Images shown are preview data-URLs. Click <b>Save These to DB</b> to upload to Storage
          and persist rows.
        </div>
      )}
    </div>
  );
}
