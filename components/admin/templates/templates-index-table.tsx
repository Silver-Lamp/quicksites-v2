'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import RowActions from '@/components/admin/templates/row-actions';
import type { Template } from '@/types/template';
import { cn } from '@/lib/utils';

/* ---------------- helpers ---------------- */

function safeParse<T = any>(v: any): T | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return undefined; }
  }
  return undefined;
}

/** Prefer a `meta` object if present; otherwise derive it from `data`. */
function getMeta(t: any): Record<string, any> | undefined {
  const fromData = safeParse<Record<string, any>>(t?.data);
  return (t?.meta && typeof t.meta === 'object' ? t.meta : undefined) ?? fromData?.meta ?? fromData;
}

function titleFromKey(key?: string): string {
  if (!key) return '';
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Return the best-available industry, preferring site meta if MV is generic. */
function resolveIndustry(t: any): string {
  const mv = (t?.industry ?? '').toString().trim();
  if (mv && mv.toLowerCase() !== 'general') return mv;

  const meta: any = getMeta(t) ?? {};
  const v = meta?.industry ?? meta?.business?.industry ?? t?.industry_gen ?? '';
  return (v ?? '').toString().trim();
}

/** City often lives in site meta at meta.contact.city. */
function resolveCity(t: any): string {
  if (t?.city) return String(t.city);
  const meta: any = getMeta(t) ?? {};
  const v =
    meta?.contact?.city ??
    meta?.city ??
    meta?.location?.city ??
    meta?.business?.city ??
    '';
  return (v ?? '').toString().trim();
}

/** Phone often lives in site meta at meta.contact.phone. */
function resolvePhone(t: any): string {
  if (t?.phone) return String(t.phone);
  const meta: any = getMeta(t) ?? {};
  const v = meta?.contact?.phone ?? meta?.phone ?? '';
  return (v ?? '').toString().trim();
}

/** Preview fallback: try banner_url, then any common meta image fields. */
function resolvePreviewUrl(t: any): string | null {
  if (t?.banner_url) return t.banner_url as string;
  const meta: any = getMeta(t) ?? {};
  return meta?.banner_url ?? meta?.ogImage ?? meta?.hero_url ?? null;
}

/** Resolve a canonical site type key from row/meta. */
function resolveSiteType(t: any): string {
  // 1) Direct column or meta
  const meta: any = getMeta(t) ?? {};
  const direct = (t?.site_type ?? meta?.site_type ?? '').toString().trim().toLowerCase();
  if (direct) return direct;

  // 2) Infer from industry_label when industry === 'other'
  const ind = (meta?.industry ?? t?.industry ?? '').toString().trim().toLowerCase();
  const label = (meta?.industry_label ?? '').toString().trim().toLowerCase();
  if (ind === 'other' && label) {
    if (['portfolio', 'blog', 'about me', 'about_me'].includes(label)) {
      if (label === 'about me') return 'about_me';
      return label;
    }
  }

  // 3) Default if nothing else
  return '';
}

export default function TemplatesIndexTable({
  templates,
  selectedFilter = '',
}: {
  templates: Template[];
  selectedFilter?: string;
}) {
  const [currentFilter, setCurrentFilter] = useState(selectedFilter);
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // NEW: route loading overlay
  const [navigating, setNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Ask the Refresh button to perform its full action (which dispatches list refetch)
  const dispatchRefreshButton = useCallback((reason: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('qs:templates:refresh', { detail: { reason } }));
  }, []);

  const filtered = useMemo(() => {
    return (templates as any[])
      .filter((t) => {
        const isLocallyArchived = archivedIds.includes(t.id);

        // Prefer column boolean; fallback to data flag; then local override
        const colFlag = typeof (t as any).archived === 'boolean' ? (t as any).archived : undefined;

        const dataFlagRaw =
          (t as any)?.data && typeof (t as any).data === 'object'
            ? (t as any).data.archived
            : undefined;

        const dataFlag =
          typeof dataFlagRaw === 'boolean'
            ? dataFlagRaw
            : typeof dataFlagRaw === 'string'
            ? dataFlagRaw.toLowerCase() === 'true'
            : undefined;

        const isArchived = (colFlag ?? dataFlag ?? isLocallyArchived) === true;

        if (archiveFilter === 'archived') return isArchived;
        if (archiveFilter === 'active') return !isArchived;
        return true;
      })
      .filter((t) => {
        const term = search.toLowerCase();

        // Search display_name first, then template_name & slug
        const name = ((t as any).display_name || (t as any).template_name || '')
          .toString()
          .toLowerCase();
        const slug = ((t as any).slug || '').toString().toLowerCase();

        // Use robust resolvers for search too
        const industry = resolveIndustry(t).toLowerCase();
        const city = resolveCity(t).toLowerCase();

        // NEW: search by site type too
        const typeKey = resolveSiteType(t);
        const typeLabel = titleFromKey(typeKey).toLowerCase();

        return (
          name.includes(term) ||
          slug.includes(term) ||
          industry.includes(term) ||
          city.includes(term) ||
          typeKey.includes(term) ||
          typeLabel.includes(term)
        );
      });
  }, [templates, search, archiveFilter, archivedIds]);

  useEffect(() => {
    setLastSelectedIndex(null);
  }, [filtered]);

  // Debug helper – enable with: localStorage.setItem('QS_DEBUG_TEMPLATES', '1')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('QS_DEBUG_TEMPLATES')) return;
    const sample = (templates as any[])[0];
    const meta = getMeta(sample);
    console.debug('[TemplatesIndexTable] sample row:', {
      id: sample?.id,
      displayName: (sample as any)?.display_name,
      mvIndustry: sample?.industry,
      resolvedIndustry: resolveIndustry(sample),
      resolvedSiteType: resolveSiteType(sample),
      cityProp: sample?.city,
      resolvedCity: resolveCity(sample),
      phoneProp: sample?.phone,
      resolvedPhone: resolvePhone(sample),
      hasData: !!sample?.data,
      metaKeys: meta ? Object.keys(meta) : null,
      metaContact: meta?.contact ?? null,
    });
  }, [templates]);

  function toggleSelectionRange(index: number, willSelect: boolean, opts?: { exclusive?: boolean }) {
    const start = Math.min(lastSelectedIndex ?? index, index);
    const end = Math.max(lastSelectedIndex ?? index, index);
    const rangeIds = filtered.slice(start, end + 1).map((t: any) => t.id);

    setSelectedIds((prev) => {
      if (opts?.exclusive) return willSelect ? [...rangeIds] : [];
      if (willSelect) {
        const set = new Set(prev);
        rangeIds.forEach((id) => set.add(id));
        return Array.from(set);
      } else {
        const remove = new Set(rangeIds);
        return prev.filter((id) => !remove.has(id));
      }
    });
  }

  const handleBulkArchive = async (ids: string[]) => {
    const res = await fetch('/api/templates/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, archived: true }),
    });

    if (res.ok) {
      setArchivedIds((prev) => [...prev, ...ids]);
      setSelectedIds([]);
      toast.success(`${ids.length} template${ids.length > 1 ? 's' : ''} archived`);
      setTimeout(() => dispatchRefreshButton('bulk-archive'), 100);
    } else {
      toast.error('Bulk archive failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Loading overlay when navigating to a template */}
      {navigating && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-xl bg-zinc-900/85 border border-white/10 px-6 py-4 flex items-center gap-3 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm">
              Opening {navigatingTo ? <span className="font-medium">{navigatingTo}</span> : 'template'}…
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="text-lg font-semibold text-white">Templates</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 text-xs">
            <Button
              variant={archiveFilter === 'active' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('active')}
            >
              Active
            </Button>
            <Button
              variant={archiveFilter === 'archived' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('archived')}
            >
              Archived
            </Button>
            <Button
              variant={archiveFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setArchiveFilter('all')}
            >
              All
            </Button>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, type, industry, or city…"
            className="text-sm w-64"
          />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-10 bg-zinc-950 px-4 py-2 border-b border-white/10">
          <div className="flex justify-start">
            <Button
              variant="destructive"
              className="text-xs text-white bg-red-500 hover:bg-red-600"
              onClick={() => handleBulkArchive(selectedIds)}
            >
              Archive {selectedIds.length} selected
            </Button>
          </div>
        </div>
      )}

      <div className="border border-white/10 rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-zinc-900 text-white text-left">
              <th className="p-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(filtered.map((t: any) => t.id));
                    else setSelectedIds([]);
                  }}
                />
              </th>
              <th className="p-2 text-right">Actions</th>
              <th className="p-2">Published</th>
              <th className="p-2">Name</th>
              {/* NEW: Type */}
              <th className="p-2">Type</th>
              <th className="p-2">Industry</th>
              <th className="p-2">City</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Updated</th>
              <th className="p-2">GSC</th>
              <th className="p-2 w-[60px]">Preview</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t: any, index: number) => {
              const updated = t.effective_updated_at ?? t.updated_at;

              const industryKey = resolveIndustry(t);
              const cityVal = resolveCity(t);
              const phoneVal = resolvePhone(t);
              const typeKey = resolveSiteType(t);

              const displayType = typeKey ? titleFromKey(typeKey) : '—';
              const displayIndustry = industryKey ? titleFromKey(industryKey) : '—';
              const displayCity = cityVal || '—';
              const previewUrl = resolvePreviewUrl(t);

              const mainName = (t.display_name || t.template_name || t.slug || t.id) as string;

              const archivedFlag =
                typeof t.archived === 'boolean' ? t.archived : !!t?.data?.archived;

              return (
                <tr
                  key={t.id}
                  className={cn(
                    'border-t border-white/10 hover:bg-zinc-800 transition',
                    archivedFlag && 'opacity-50 italic'
                  )}
                >
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onClick={(e) => {
                        const evt = e as React.MouseEvent<HTMLInputElement>;
                        const withShift = evt.shiftKey;
                        const withMeta = evt.metaKey || evt.ctrlKey;
                        const isChecked = selectedIds.includes(t.id);
                        const willSelect = !isChecked;

                        if (withShift && lastSelectedIndex !== null) {
                          const start = Math.min(lastSelectedIndex ?? index, index);
                          const end = Math.max(lastSelectedIndex ?? index, index);
                          const rangeIds = filtered.slice(start, end + 1).map((r: any) => r.id);
                          setSelectedIds((prev) => {
                            if (withMeta) return willSelect ? [...rangeIds] : [];
                            if (willSelect) {
                              const set = new Set(prev);
                              rangeIds.forEach((id) => set.add(id));
                              return Array.from(set);
                            } else {
                              const remove = new Set(rangeIds);
                              return prev.filter((id) => !remove.has(id));
                            }
                          });
                        } else if (withMeta) {
                          setSelectedIds(willSelect ? [t.id] : []);
                        } else {
                          setSelectedIds((prev) =>
                            isChecked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                          );
                        }

                        setLastSelectedIndex(index);
                      }}
                      onChange={() => {}}
                    />
                  </td>

                  <td className="p-2 text-right">
                    <RowActions
                      id={t.id}
                      slug={t.slug}
                      archived={archivedFlag}
                      onArchiveToggle={(id, archived) => {
                        (async () => {
                          try {
                            const res = await fetch('/api/templates/archive', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ids: [id], archived }),
                            });

                            if (!res.ok) {
                              const j = await res.json().catch(() => ({}));
                              toast.error(`Failed to ${archived ? 'archive' : 'restore'} template`);
                              if (j?.failures) console.warn('Archive failures:', j.failures);
                              return;
                            }

                            // optimistic UI
                            setArchivedIds((prev) => (archived ? [...prev, id] : prev.filter((x) => x !== id)));
                            toast.success(`Template ${archived ? 'archived' : 'restored'}`);

                            setTimeout(() => dispatchRefreshButton('single-archive'), 100);
                          } catch {
                            toast.error('Network error archiving template');
                          }
                        })();
                      }}
                    />
                  </td>

                  <td className="p-2 text-zinc-400">
                    {t.published ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </td>

                  <td className="p-2">
                    <Link
                      href={`/template/${t.id}/edit`}
                      prefetch={false}
                      className="text-white hover:underline text-left block leading-tight"
                      onClick={() => {
                        setNavigatingTo(mainName || t.slug || t.id);
                        setNavigating(true);
                      }}
                    >
                      <div className="font-medium truncate">{mainName}</div>
                      {t.slug ? (
                        <div className="text-[11px] text-white/45 mt-0.5 truncate">{t.slug}</div>
                      ) : null}
                    </Link>
                  </td>

                  {/* NEW: Type column */}
                  <td className="p-2 text-zinc-200">{displayType}</td>

                  <td className="p-2 text-zinc-200">{displayIndustry}</td>
                  <td className="p-2 text-zinc-400">{displayCity}</td>

                  <td className="p-2 text-zinc-400">
                    {phoneVal ? <div className="text-xs text-zinc-400">{phoneVal}</div> : null}
                  </td>

                  <td className="p-2 text-zinc-400">
                    {updated ? formatDistanceToNow(new Date(updated), { addSuffix: true }) : 'N/A'}
                  </td>

                  <td className="p-2 text-zinc-400" />

                  <td className="p-2">
                    {previewUrl ? (
                      <img src={previewUrl} alt="preview" className="w-12 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs text-white/40">
                        N/A
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
