'use client';

import { useState, useMemo, useEffect, useCallback, Fragment, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Loader2, ChevronRight, ChevronDown, Info } from 'lucide-react';
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

function resolvePhone(t: any): string {
  if (t?.phone) return String(t.phone);
  const meta: any = getMeta(t) ?? {};
  const v = meta?.contact?.phone ?? meta?.phone ?? '';
  return (v ?? '').toString().trim();
}

function resolvePreviewUrl(t: any): string | null {
  if (t?.banner_url) return t.banner_url as string;
  const meta: any = getMeta(t) ?? {};
  return meta?.banner_url ?? meta?.ogImage ?? meta?.hero_url ?? null;
}

/** Resolve a canonical site type key from row/meta. */
function resolveSiteType(t: any): string {
  const meta: any = getMeta(t) ?? {};
  const direct = (t?.site_type ?? meta?.site_type ?? '').toString().trim().toLowerCase();
  if (direct) return direct;

  const ind = (meta?.industry ?? t?.industry ?? '').toString().trim().toLowerCase();
  const label = (meta?.industry_label ?? '').toString().trim().toLowerCase();
  if (ind === 'other' && label) {
    if (['portfolio', 'blog', 'about me', 'about_me'].includes(label)) {
      if (label === 'about me') return 'about_me';
      return label;
    }
  }

  // Optional inference: common Portfolio hero phrasing
  const data = safeParse<any>(t?.data);
  const home = data?.pages?.[0];
  const hero =
    home?.blocks?.find?.((b: any) => b.type === 'hero') ||
    home?.content_blocks?.find?.((b: any) => b.type === 'hero');
  const cta = (hero?.props?.ctaLabel || hero?.content?.cta_text || '').toString().toLowerCase();
  const h  = (hero?.props?.heading || hero?.content?.headline || '').toString().toLowerCase();
  if (cta.includes('view portfolio') || h.includes('portfolio')) return 'portfolio';

  return '';
}

const stripToken = (s?: string | null) =>
  (s || '').toString().replace(/(-[a-z0-9]{2,12})+$/i, '');

/** Grouping key: prefer server-provided base_key; else canonical/base/derived */
function baseKey(t: any): string {
  const apiKey = (t?.base_key || '').toString().trim();
  if (apiKey) return apiKey;

  const canonical = (t?.canonical_id || '').toString().trim();
  if (canonical) return canonical;

  const base = (t?.base_slug || '').toString().trim();
  if (base) return base;

  const src = (t?.slug || t?.template_name || '').toString();
  if (!src) return t?.id || '';
  const stripped = stripToken(src);
  return stripped || src;
}

/** Aggressive grouping key: prefer canonical_slug/base_slug, then strip */
function rootKey(t: any): string {
  const cslug = (t?.canonical_slug || '').toString().trim();
  if (cslug) return stripToken(cslug);
  const bslug = (t?.base_slug || '').toString().trim();
  if (bslug) return stripToken(bslug);
  const s = (t?.slug || t?.template_name || '').toString();
  if (!s) return t?.id || '';
  return stripToken(s);
}

/** Score for choosing the “primary” variant in a group. Higher is better. */
function scoreForPrimary(t: any): number {
  let s = 0;
  const type = resolveSiteType(t);
  const ind = resolveIndustry(t);
  if (type) s += 100;                // prefer rows with explicit site type
  if (ind && ind !== 'general') s += 10;
  const rev = Number(t?.rev ?? 0);
  if (Number.isFinite(rev)) s += Math.min(rev, 1_000); // prefer higher rev
  const updated = t?.effective_updated_at || t?.updated_at;
  if (updated) {
    const ts = new Date(updated).getTime();
    if (Number.isFinite(ts)) s += ts / 1e11; // tiny tie-breaker by recency
  }
  const meta: any = getMeta(t) ?? {};
  const svc =
    Array.isArray(meta?.services) ? meta.services.length :
    Array.isArray(safeParse<any>(t?.data)?.services) ? safeParse<any>(t?.data)!.services.length :
    0;
  s += Math.min(svc, 20);
  return s;
}

/* ---------------- component ---------------- */

type GroupMode = 'none' | 'base' | 'root';
const GROUP_MODE_KEY = 'qs:templates:groupMode';

export default function TemplatesIndexTable({
  templates,
  selectedFilter = '',
  includeVersions = false,
}: {
  templates: Template[];
  selectedFilter?: string;
  includeVersions?: boolean;
}) {
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Grouping mode (restore from localStorage, fall back to 'base')
  const [groupMode, setGroupMode] = useState<GroupMode>(() => {
    try {
      const saved = localStorage.getItem(GROUP_MODE_KEY);
      if (saved === 'none' || saved === 'base' || saved === 'root') return saved as GroupMode;
    } catch {}
    return 'base';
  });

  // Track if a saved preference exists (so we don't auto-switch Base→Root if user already chose)
  const hasSavedPrefRef = useRef(false);
  useEffect(() => {
    try { hasSavedPrefRef.current = !!localStorage.getItem(GROUP_MODE_KEY); } catch {}
  }, []);

  // Persist the group mode whenever it changes
  useEffect(() => {
    try { localStorage.setItem(GROUP_MODE_KEY, groupMode); } catch {}
  }, [groupMode]);

  // route loading overlay
  const [navigating, setNavigating] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const dispatchRefreshButton = useCallback((reason: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('qs:templates:refresh', { detail: { reason } }));
  }, []);

  /* ---------- base filters (archive + search) ---------- */
  const filtered = useMemo(() => {
    const list = (templates as any[]).filter((t) => {
      const isLocallyArchived = archivedIds.includes(t.id);

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
    });

    const term = search.toLowerCase();
    if (!term) return list;

    return list.filter((t) => {
      const name = ((t as any).display_name || (t as any).template_name || '')
        .toString()
        .toLowerCase();
      const slug = ((t as any).slug || '').toString().toLowerCase();
      const industry = resolveIndustry(t).toLowerCase();
      const city = resolveCity(t).toLowerCase();

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

  /* ---------- grouping ---------- */
  type Group = { key: string; rows: any[]; primary: any; children: any[] };

  const grouped: Group[] = useMemo(() => {
    if (groupMode === 'none') {
      return filtered.map((r) => ({ key: r.id, rows: [r], primary: r, children: [] }));
    }

    const map = new Map<string, any[]>();
    const pickKey = groupMode === 'root' ? rootKey : baseKey;

    for (const r of filtered) {
      const k = pickKey(r);
      const arr = map.get(k);
      if (arr) arr.push(r); else map.set(k, [r]);
    }

    const out: Group[] = [];
    for (const [key, list] of map) {
      if (list.length === 1) {
        out.push({ key, rows: list, primary: list[0], children: [] });
        continue;
      }
      const sorted = [...list].sort((a, b) => scoreForPrimary(b) - scoreForPrimary(a));
      const primary = sorted[0];
      const children = sorted.slice(1).sort((a, b) => {
        const au = new Date(a.effective_updated_at || a.updated_at || 0).getTime();
        const bu = new Date(b.effective_updated_at || b.updated_at || 0).getTime();
        return bu - au;
      });
      out.push({ key, rows: list, primary, children });
    }

    // sort groups by primary recency
    out.sort((A, B) => {
      const au = new Date(A.primary.effective_updated_at || A.primary.updated_at || 0).getTime();
      const bu = new Date(B.primary.effective_updated_at || B.primary.updated_at || 0).getTime();
      return bu - au;
    });

    return out;
  }, [filtered, groupMode]);

  // expanded state per group
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = useCallback((key: string) => {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  // selection range helper
  function toggleSelectionRange(index: number, willSelect: boolean, idsInView: string[], opts?: { exclusive?: boolean }) {
    const start = Math.min(lastSelectedIndex ?? index, index);
    const end = Math.max(lastSelectedIndex ?? index, index);
    const rangeIds = idsInView.slice(start, end + 1);

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

  /* ---------------- ids in view (for shift-select) ---------------- */
  const idsInView = useMemo(() => {
    const arr: string[] = [];
    grouped.forEach((g) => {
      arr.push(g.primary.id);
      if (g.children.length && expanded[g.key]) g.children.forEach((c) => arr.push(c.id));
    });
    return arr;
  }, [grouped, expanded]);

  /* ---------------- bulk archive ---------------- */
  const handleBulkArchive = async (ids: string[]) => {
    const res = await fetch('/api/templates/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, archived: true }),
    });

    if (res.ok) {
      toast.success(`${ids.length} template${ids.length > 1 ? 's' : ''} archived`);
      setTimeout(() => dispatchRefreshButton('bulk-archive'), 100);
    } else {
      toast.error('Bulk archive failed');
    }
  };

  /* -------------------- render helpers -------------------- */

  // Quick hint: if Base grouping found no multi-row groups
  const showBaseHint = useMemo(() => {
    if (groupMode !== 'base') return false;
    const multi = grouped.some((g) => g.children.length > 0);
    return !multi && filtered.length > 1;
  }, [grouped, groupMode, filtered.length]);

  // One-time auto-switch from Base → Root (only if user hasn't chosen a pref)
  const didAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (didAutoSwitchRef.current) return;
    if (groupMode !== 'base') return;
    if (hasSavedPrefRef.current) return;
    if (showBaseHint) {
      setGroupMode('root');
      didAutoSwitchRef.current = true;
      try { localStorage.setItem(GROUP_MODE_KEY, 'root'); } catch {}
    }
  }, [groupMode, showBaseHint]);

  const renderPrimaryRow = (t: any, gKey: string, hasChildren: number) => {
    const updated = t.effective_updated_at ?? t.updated_at;
    const industryKey = resolveIndustry(t);
    const typeKey = resolveSiteType(t);

    const displayType = typeKey ? titleFromKey(typeKey) : '—';
    const displayIndustry = industryKey ? titleFromKey(industryKey) : '—';
    const displayCity = resolveCity(t) || '—';
    const phoneVal = resolvePhone(t);
    const previewUrl = resolvePreviewUrl(t);
    const mainName = (t.display_name || t.template_name || t.slug || t.id) as string;

    const archivedFlag =
      typeof t.archived === 'boolean' ? t.archived : !!t?.data?.archived;

    const rowIndexInView = idsInView.indexOf(t.id);

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

              if (withShift && rowIndexInView !== -1 && lastSelectedIndex !== null) {
                toggleSelectionRange(rowIndexInView, willSelect, idsInView, { exclusive: withMeta });
              } else if (withMeta) {
                setSelectedIds(willSelect ? [t.id] : []);
              } else {
                setSelectedIds((prev) =>
                  isChecked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                );
              }
              setLastSelectedIndex(rowIndexInView === -1 ? null : rowIndexInView);
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

                  toast.success(`Template ${archived ? 'archived' : 'restored'}`);
                  setTimeout(
                    () => window.dispatchEvent(new CustomEvent('qs:templates:refresh')),
                    120
                  );
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

        {/* Name + group toggle */}
        <td className="p-2">
          <div className="flex items-start gap-2">
            {groupMode !== 'none' && hasChildren > 0 ? (
              <button
                className="mt-[2px] text-white/70 hover:text-white"
                onClick={() => toggleGroup(gKey)}
                title={expanded[gKey] ? 'Collapse variants' : 'Expand variants'}
              >
                {expanded[gKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            <div className="min-w-0">
              <Link
                href={`/template/${t.id}/edit`}
                prefetch={false}
                className="text-white hover:underline block leading-tight truncate"
                onClick={() => { setNavigatingTo(mainName || t.slug || t.id); setNavigating(true); }}
              >
                <div className="font-medium truncate">{mainName}</div>
                {t.slug ? (
                  <div className="text-[11px] text-white/45 mt-0.5 truncate">{t.slug}</div>
                ) : null}
              </Link>
              {groupMode !== 'none' && hasChildren > 0 && (
                <div className="text-[11px] text-white/45 mt-0.5">
                  {expanded[gKey]
                    ? `${hasChildren} variant${hasChildren === 1 ? '' : 's'}`
                    : `+${hasChildren} variant${hasChildren === 1 ? '' : 's'}`}
                </div>
              )}
            </div>
          </div>
        </td>

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
  };

  const renderChildRow = (c: any) => {
    const cUpdated = c.effective_updated_at ?? c.updated_at;
    const cType = resolveSiteType(c);
    const cIndustry = resolveIndustry(c);
    const cCity = resolveCity(c);
    const cPhone = resolvePhone(c);
    const cPreview = resolvePreviewUrl(c);
    const cName = (c.display_name || c.template_name || c.slug || c.id) as string;

    const cArchived =
      typeof c.archived === 'boolean' ? c.archived : !!c?.data?.archived;

    const idxInView = idsInView.indexOf(c.id);

    return (
      <tr key={c.id} className="bg-zinc-900/40 border-t border-white/10">
        <td className="p-2 pl-6">
          <input
            type="checkbox"
            checked={selectedIds.includes(c.id)}
            onClick={(e) => {
              const evt = e as React.MouseEvent<HTMLInputElement>;
              const withShift = evt.shiftKey;
              const withMeta = evt.metaKey || evt.ctrlKey;
              const isChecked = selectedIds.includes(c.id);
              const willSelect = !isChecked;

              if (withShift && idxInView !== -1 && lastSelectedIndex !== null) {
                toggleSelectionRange(idxInView, willSelect, idsInView, { exclusive: withMeta });
              } else if (withMeta) {
                setSelectedIds(willSelect ? [c.id] : []);
              } else {
                setSelectedIds((prev) =>
                  isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                );
              }
              setLastSelectedIndex(idxInView === -1 ? null : idxInView);
            }}
            onChange={() => {}}
          />
        </td>

        <td className="p-2 text-right">
          <RowActions
            id={c.id}
            slug={c.slug}
            archived={cArchived}
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

                  toast.success(`Template ${archived ? 'archived' : 'restored'}`);
                  setTimeout(() => window.dispatchEvent(new CustomEvent('qs:templates:refresh')), 120);
                } catch {
                  toast.error('Network error archiving template');
                }
              })();
            }}
          />
        </td>

        <td className="p-2 text-zinc-400">
          {c.published ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
        </td>

        <td className="p-2 pl-8">
          <Link
            href={`/template/${c.id}/edit`}
            prefetch={false}
            className="text-white hover:underline block leading-tight truncate"
            onClick={() => { setNavigatingTo(cName || c.slug || c.id); setNavigating(true); }}
          >
            <div className="truncate">{cName}</div>
            {c.slug ? (
              <div className="text-[11px] text-white/45 mt-0.5 truncate">{c.slug}</div>
            ) : null}
          </Link>
        </td>

        <td className="p-2 text-zinc-300">{cType ? titleFromKey(cType) : '—'}</td>
        <td className="p-2 text-zinc-300">{cIndustry ? titleFromKey(cIndustry) : '—'}</td>
        <td className="p-2 text-zinc-400">{cCity || '—'}</td>
        <td className="p-2 text-zinc-400">{cPhone || ''}</td>
        <td className="p-2 text-zinc-400">
          {cUpdated ? formatDistanceToNow(new Date(cUpdated), { addSuffix: true }) : 'N/A'}
        </td>
        <td className="p-2 text-zinc-400" />
        <td className="p-2">
          {cPreview ? (
            <img src={cPreview} alt="preview" className="w-12 h-8 rounded object-cover" />
          ) : (
            <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center text-xs text-white/40">
              N/A
            </div>
          )}
        </td>
      </tr>
    );
  };

  /* -------------------- render -------------------- */
  return (
    <div className="space-y-6">
      {/* Loading overlay when navigating */}
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

          {/* Grouping selector (persisted) */}
          <label className="text-xs text-white/70 inline-flex items-center gap-2 ml-2">
            Group by
            <select
              value={groupMode}
              onChange={(e) => {
                const v = e.target.value as GroupMode;
                setGroupMode(v);
                try { localStorage.setItem(GROUP_MODE_KEY, v); } catch {}
                hasSavedPrefRef.current = true; // user explicitly chose
              }}
              className="bg-zinc-900 border border-white/15 rounded px-2 py-1 text-xs text-white"
            >
              <option value="none">None</option>
              <option value="base">Base</option>
              <option value="root">Root (aggressive)</option>
            </select>
          </label>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, type, industry, or city…"
            className="text-sm w-64"
          />
        </div>
      </div>

      {/* Optional hint when Base grouping finds nothing to collapse */}
      {showBaseHint && (
        <div className="rounded-md border border-white/10 bg-white/5 text-white/80 text-xs px-3 py-2 flex items-center gap-2">
          <Info className="w-4 h-4 opacity-80" />
          No shared bases found to collapse. Try <span className="font-medium">Root (aggressive)</span> if these are visually related variants.
        </div>
      )}

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
                  checked={idsInView.length > 0 && selectedIds.length === idsInView.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(idsInView);
                    else setSelectedIds([]);
                  }}
                />
              </th>
              <th className="p-2 text-right">Actions</th>
              <th className="p-2">Published</th>
              <th className="p-2">Name</th>
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
            {grouped.map((g) => (
              <Fragment key={g.key}>
                {renderPrimaryRow(g.primary, g.key, g.children.length)}
                {groupMode !== 'none' && expanded[g.key] && g.children.map((c) => renderChildRow(c))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
