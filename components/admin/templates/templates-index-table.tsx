// components/admin/templates/templates-index-table.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'react-hot-toast';
import { CheckCircle, FileStack, Globe, XCircle } from 'lucide-react';
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
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Return the best-available industry, preferring site meta if MV is generic. */
function resolveIndustry(t: any): string {
  const mv = (t?.industry ?? '').toString().trim();
  if (mv && mv.toLowerCase() !== 'general') return mv;

  const meta: any = getMeta(t) ?? {};
  const v =
    meta?.industry ??
    meta?.business?.industry ??
    t?.industry_gen ??
    '';
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
  const v =
    meta?.contact?.phone ??
    meta?.phone ??
    '';
  return (v ?? '').toString().trim();
}

/** Preview fallback: try banner_url, then any common meta image fields. */
function resolvePreviewUrl(t: any): string | null {
  if (t?.banner_url) return t.banner_url as string;
  const meta: any = getMeta(t) ?? {};
  return (
    meta?.banner_url ??
    meta?.ogImage ??
    meta?.hero_url ??
    null
  );
}

export default function TemplatesIndexTable({
  templates,
  selectedFilter = '',
}: {
  templates: Template[];
  selectedFilter?: string;
}) {
  const router = useRouter();
  const [currentFilter, setCurrentFilter] = useState(selectedFilter);
  const [viewMode, setViewMode] = useState<'all' | 'templates' | 'sites'>('all');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [restoredIds, setRestoredIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return (templates as any[])
      .filter((t) => {
        const isLocallyArchived = archivedIds.includes(t.id);
        const isArchived = t?.data?.archived ?? isLocallyArchived;
        if (archiveFilter === 'archived') return isArchived;
        if (archiveFilter === 'active') return !isArchived;
        return true;
      })
      .filter((t) => {
        const term = search.toLowerCase();

        // NEW: search display_name first, then template_name & slug
        const name =
          ((t.display_name || t.template_name || '') as string).toLowerCase();
        const slug = (t.slug || '').toLowerCase();

        // Use robust resolvers for search too
        const industry = resolveIndustry(t).toLowerCase();
        const city = resolveCity(t).toLowerCase();

        return (
          name.includes(term) ||
          slug.includes(term) ||
          industry.includes(term) ||
          city.includes(term)
        );
      })
      .filter((t) => {
        if (viewMode === 'sites') return (t as any).is_site === true;
        if (viewMode === 'templates') return !(t as any).is_site;
        return true;
      });
  }, [templates, search, viewMode, archiveFilter, archivedIds]);

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
      if (opts?.exclusive) {
        return willSelect ? [...rangeIds] : [];
      }
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
    } else {
      toast.error('Bulk archive failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="text-lg font-semibold text-white">Templates</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 text-xs">
            <Button variant={viewMode === 'all' ? 'default' : 'outline'} onClick={() => setViewMode('all')}>All</Button>
            <Button variant={viewMode === 'templates' ? 'default' : 'outline'} onClick={() => setViewMode('templates')}>Templates</Button>
            <Button variant={viewMode === 'sites' ? 'default' : 'outline'} onClick={() => setViewMode('sites')}>Sites</Button>
          </div>
          <div className="flex gap-1 text-xs">
            <Button variant={archiveFilter === 'active' ? 'default' : 'outline'} onClick={() => setArchiveFilter('active')}>Active</Button>
            <Button variant={archiveFilter === 'archived' ? 'default' : 'outline'} onClick={() => setArchiveFilter('archived')}>Archived</Button>
            <Button variant={archiveFilter === 'all' ? 'default' : 'outline'} onClick={() => setArchiveFilter('all')}>All</Button>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, industry, or city…"
            className="text-sm w-64"
          />
          {/* Show/Hide Versions toggle is elsewhere (client/page) */}
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
              <th className="p-2 text-right">Type</th>
              <th className="p-2">Published</th>
              <th className="p-2">Name</th>
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

              const displayIndustry = industryKey ? titleFromKey(industryKey) : '—';
              const displayCity = cityVal || '—';
              const previewUrl = resolvePreviewUrl(t);

              const mainName = (t.display_name || t.template_name || t.slug || t.id) as string;

              return (
                <tr
                  key={t.id}
                  className={cn(
                    'border-t border-white/10 hover:bg-zinc-800 transition',
                    t?.data?.archived && 'opacity-50 italic',
                    restoredIds.includes(t.id) && 'animate-fadeIn'
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
                          toggleSelectionRange(index, willSelect, { exclusive: withMeta });
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
                      archived={t?.data?.archived ?? false}
                      onArchiveToggle={(id, archived) => {
                        fetch('/api/templates/archive', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ids: [id], archived }),
                        }).then((res) => {
                          if (res.ok) {
                            setArchivedIds((prev) => archived ? [...prev, id] : prev.filter((x) => x !== id));
                            setRestoredIds((prev) => archived ? prev : [...prev, id]);
                            toast.success(`Template ${archived ? 'archived' : 'restored'}`);
                          } else {
                            toast.error(`Failed to ${archived ? 'archive' : 'restore'} template`);
                          }
                        });
                      }}
                    />
                  </td>

                  <td className="p-2 text-right">
                    {t.is_site ? <Globe className="w-4 h-4 text-blue-400" /> : <FileStack className="w-4 h-4 text-blue-400" />}
                  </td>

                  <td className="p-2 text-zinc-400">
                    {t.published ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </td>

                  <td className="p-2">
                    <Link
                      href={`/template/${t.id}/edit`}
                      prefetch={false}
                      className="text-white hover:underline text-left block leading-tight"
                    >
                      <div className="font-medium truncate">{mainName}</div>
                      {t.slug ? (
                        <div className="text-[11px] text-white/45 mt-0.5 truncate">{t.slug}</div>
                      ) : null}
                    </Link>
                  </td>

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
                      <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs text-white/40">N/A</div>
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
