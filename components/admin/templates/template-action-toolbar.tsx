// components/admin/templates/TemplateActionToolbar.tsx
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, RotateCw, AlertTriangle, X, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';
import type { Template } from '@/types/template';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import AsyncGifOverlay from '@/components/ui/async-gif-overlay';

// ---------- helpers ----------
const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

function baseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}
function randSuffix() {
  const p = () => Math.random().toString(36).slice(2, 6);
  return `${p()}-${p().slice(0, 2)}`;
}

async function resolveSlugForId(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('templates').select('slug').eq('id', id).maybeSingle();
  if (error) return null;
  return data?.slug ?? null;
}

function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}
function stripHFPage(page: any) {
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return { ...page, content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)) };
}
function normalizeForSnapshot(t: Template): Template {
  const tpl: any = JSON.parse(JSON.stringify(t));
  const pagesIn = getPages(tpl);
  let headerBlock = tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock = tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = Array.isArray(pagesIn[0]?.content_blocks) ? pagesIn[0].content_blocks : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHFPage);

  tpl.headerBlock = headerBlock ?? null;
  tpl.footerBlock = footerBlock ?? null;
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  const topMode = tpl?.color_mode;
  const nestedMode = tpl?.data?.color_mode;
  if (topMode !== 'light' && topMode !== 'dark' && (nestedMode === 'light' || nestedMode === 'dark')) {
    tpl.color_mode = nestedMode;
  }
  return tpl as Template;
}
function buildSharedSnapshotPayload(t: Template) {
  const normalized = normalizeForSnapshot(t);
  const templateData = {
    ...(normalized.data ?? {}),
    pages: getPages(normalized),
    headerBlock: normalized.headerBlock ?? null,
    footerBlock: normalized.footerBlock ?? null,
  };
  return { normalized, templateData };
}

// ---------- component ----------
type SaveWarning = { field: string; message: string };
type Props = {
  template: Template;
  autosaveStatus?: string;
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function TemplateActionToolbar({ template, autosaveStatus, onSaveDraft, onUndo, onRedo }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState('Draft');

  // versions are rows from *templates* clustered by base slug
  const [versions, setVersions] = useState<Array<any>>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versionsRef = useRef<HTMLDivElement | null>(null);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMsg, setOverlayMsg] = useState<string>('Working…');
  const [saveWarnings, setSaveWarnings] = useState<SaveWarning[]>([]);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ----- fetch versions from templates -----
  useEffect(() => {
    if (!template) return;

    let mounted = true;
    const tSlug = (template as any).slug || '';
    const tName = template.template_name || '';
    const bSlug = baseSlug(tSlug || tName);
    const selectCols =
      'id, slug, commit, created_at, updated_at, archived, data, header_block, footer_block, color_mode';

    async function load() {
      // try fast path: base_slug column
      let res = await supabase
        .from('templates')
        .select(selectCols)
        .eq('base_slug', bSlug)
        .order('updated_at', { ascending: false })
        .limit(50);

      // if base_slug not deployed (42703), fall back to slug OR slug ILIKE 'bSlug-%'
      if ((res as any)?.error?.code === '42703') {
        res = await supabase
          .from('templates')
          .select(selectCols)
          .or(`slug.eq.${bSlug},slug.ilike.${bSlug}-%`)
          .order('updated_at', { ascending: false })
          .limit(50);
      }

      const { data, error } = res;
      if (!mounted) return;
      if (error) {
        console.warn('[Toolbar] Versions fetch failed:', error.message);
        setVersions([]);
        return;
      }

      // exclude current row from the dropdown
      const rows = (data ?? []).filter((r: any) => r.id !== (template as any).id);
      setVersions(rows);
      setStatus(template?.published ? 'Published' : 'Draft');
    }

    load();
    return () => {
      mounted = false;
    };
  }, [(template as any)?.slug, template?.template_name, (template as any)?.id, template?.published]);

  // close menu on outside click
  useEffect(() => {
    if (!versionsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!versionsRef.current) return;
      if (!versionsRef.current.contains(e.target as Node)) setVersionsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [versionsOpen]);

  // ----- duplicate (unchanged) -----
  const handleSaveAs = async (type: 'template' | 'site') => {
    try {
      setOverlayMsg(type === 'site' ? 'Creating your site…' : 'Creating your template…');
      setOverlayOpen(true);

      const normalized = normalizeForSnapshot(template);
      const created = await saveAsTemplate(normalized, type);
      if (!created) {
        toast.error('Failed to duplicate');
        return;
      }

      const slug = created.slug ?? (created.id ? await resolveSlugForId(created.id) : null);
      router.push(slug ? `/template/${slug}/edit` : '/admin/templates');
      toast.success(`Duplicated as ${type}`);
    } catch (e) {
      console.error('[Duplicate] failed:', e);
      toast.error('Failed to duplicate');
    } finally {
      setOverlayOpen(false);
    }
  };

  // ----- share (unchanged) -----
  const handleShare = async () => {
    try {
      const { normalized, templateData } = buildSharedSnapshotPayload(template);
      const id = await createSharedPreview({
        templateId: normalized.id,
        templateName: normalized.template_name,
        templateData,
      });
      if (id) {
        toast.success('Preview shared!');
        router.push(`/shared/${id}`);
      } else {
        toast.error('Share failed');
      }
    } catch (e) {
      console.error('[Share] failed', e);
      toast.error('Share failed');
    }
  };

  // ----- save / validate (unchanged) -----
  const handleSaveClick = () => {
    try {
      const preppedDbShape = prepareTemplateForSave
        ? prepareTemplateForSave(normalizeForSnapshot(template))
        : (template as any);

      const check = validateTemplateAndFix(preppedDbShape);
      if (!check?.valid) {
        const e = (check as any).errors;
        if (e?.issues || e?.errors) {
          const issues = e.issues ?? e.errors ?? [];
          console.table(
            issues.map((iss: any) => ({
              path: Array.isArray(iss.path) ? iss.path.join('.') : String(iss.path ?? ''),
              message: iss.message ?? JSON.stringify(iss),
            }))
          );
        } else if (e?.fieldErrors) {
          console.table(
            Object.entries(e.fieldErrors).flatMap(([field, msgs]: any) =>
              (msgs ?? []).map((m: string) => ({ field, message: m }))
            )
          );
        } else {
          console.error('[Validation error]', e);
        }
        return toast.error('Validation failed — see console for details.');
      }

      if (check.warnings?.length) {
        setSaveWarnings(check.warnings as SaveWarning[]);
        check.warnings.forEach((w) => toast((t) => <span className="text-yellow-500">⚠️ {w.message}</span>));
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        warningTimerRef.current = setTimeout(() => setSaveWarnings([]), 5000);
      } else {
        setSaveWarnings([]);
      }

      onSaveDraft?.(check.data as Template);
      toast.success('Saved!');
    } catch (err) {
      console.error('❌ Exception during validation:', err);
      toast.error('Validation crashed — see console.');
    }
  };

  // ----- versions: create / restore from TEMPLATES -----
  async function createSnapshot(commit_message = 'Snapshot') {
    const normalized = normalizeForSnapshot(template);
    const bSlug = baseSlug((normalized as any).slug || normalized.template_name);
    let newSlug = `${bSlug}-${randSuffix()}`;

    // snapshot row goes into templates; keep it hidden by default
    const row: any = {
      template_name: newSlug, // MUST be unique (constraint)
      slug: newSlug,          // unique, and drives base_slug grouping
      data: normalized.data,
      header_block: normalized.headerBlock ?? null,
      footer_block: normalized.footerBlock ?? null,
      color_mode: (normalized as any).color_mode ?? null,
      industry: (template as any).industry ?? null,
      layout: (template as any).layout ?? null,
      color_scheme: (template as any).color_scheme ?? null,
      theme: (template as any).theme ?? null,
      brand: (template as any).brand ?? null,
      is_site: (template as any).is_site ?? false,
      commit: commit_message,
      archived: true, // hide from main list by default
    };

    // try insert; on rare collision, retry with a different suffix
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .from('templates')
        .insert(row)
        .select('id, slug, commit, created_at, updated_at, archived, data, header_block, footer_block, color_mode')
        .single();

      if (!error) return data!;
      if (error.code !== '23505') throw error; // not a unique-violation -> bubble

      // regenerate and retry
      newSlug = `${bSlug}-${randSuffix()}`;
      row.template_name = newSlug;
      row.slug = newSlug;
    }

    throw new Error('Could not create a unique snapshot slug');
  }

  async function restoreVersionFromTemplates(versionId: string) {
    const { data, error } = await supabase
      .from('templates')
      .select('data, header_block, footer_block, color_mode')
      .eq('id', versionId)
      .maybeSingle();

    if (error || !data) {
      console.error('[Toolbar] Failed to load version', error);
      toast.error('Failed to load version');
      return;
    }

    if (confirm('Restore this version? This will overwrite the current draft.')) {
      const restored: Template = {
        ...template,
        ...(data.header_block ? { headerBlock: data.header_block } : {}),
        ...(data.footer_block ? { footerBlock: data.footer_block } : {}),
        data: (data as any).data ?? data,
        color_mode: (data as any).color_mode ?? (template as any).color_mode,
      };
      const normalized = normalizeForSnapshot(restored);
      onSaveDraft?.(normalized);
      toast.success('Version restored!');
    }
  }

  // ----- UI bits -----
  const latestLabel = useMemo(() => {
    if (!versions.length) return 'No versions';
    const first = versions[0];
    const msg = (first.commit || '').trim() || 'Snapshot';
    const now = Date.now();
    const then = new Date(first.updated_at || first.created_at).getTime();
    const s = Math.max(1, Math.floor((now - then) / 1000));
    const rel =
      s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
    return `${msg} · ${rel} ago`;
  }, [versions]);

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-gray-900 border border-gray-700 px-6 py-3 shadow-xl max-w-5xl w-[95%] text-white opacity-90">
        <div className="w-full flex justify-between items-center gap-3">
          <div className="text-sm font-medium flex gap-3 items-center">
            <span className={`text-xs px-2 py-1 rounded ${status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'}`}>
              {status}
            </span>
            {autosaveStatus && <span className="text-xs text-gray-400 italic">💾 {autosaveStatus}</span>}
            <Button size="icon" variant="ghost" onClick={onUndo} title="Undo (⌘Z)"><RotateCcw className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={onRedo} title="Redo (⇧⌘Z)"><RotateCw className="w-4 h-4" /></Button>
          </div>

          {saveWarnings.length > 0 && (
            <div className="absolute -top-10 left-0 w-full bg-yellow-100 text-yellow-800 text-xs px-4 py-2 rounded-md border border-yellow-300 flex justify-between items-start">
              <div>{saveWarnings.map((w, i) => (<div key={i}>⚠️ {w.message}</div>))}</div>
              <button onClick={() => setSaveWarnings([])} className="ml-2 text-yellow-800 hover:text-yellow-900">×</button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Versions dropdown */}
            <div className="relative" ref={versionsRef}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVersionsOpen(v => !v)}
                title={versions.length ? 'Browse versions' : 'No versions yet'}
                className="inline-flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                <span className="text-xs sm:text-sm max-w-[14ch] sm:max-w-none truncate">
                  {versions.length ? latestLabel : 'No versions'}
                </span>
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>

              {versionsOpen && (
                <div className="absolute bottom-full mb-2 right-0 w-80 max-h-96 overflow-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl">
                  <div className="p-2 text-xs text-gray-400 sticky top-0 bg-gray-900/95 backdrop-blur">
                    {template.template_name || (template as any).slug || 'Untitled'}
                  </div>

                  {versions.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-gray-300">
                      No snapshots yet.
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const v = await createSnapshot('Initial snapshot');
                              setVersions(v ? [v, ...versions] : versions);
                              toast.success('Snapshot created');
                            } catch (e) {
                              console.error('[Snapshot] insert failed', e);
                              toast.error('Failed to create snapshot');
                            } finally {
                              setVersionsOpen(false);
                            }
                          }}
                        >
                          Create snapshot
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-1">
                      <div className="px-2 pb-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const v = await createSnapshot('Snapshot');
                              setVersions(v ? [v, ...versions] : versions);
                              toast.success('Snapshot created');
                            } catch (e) {
                              console.error('[Snapshot] insert failed', e);
                              toast.error('Failed to create snapshot');
                            } finally {
                              setVersionsOpen(false);
                            }
                          }}
                        >
                          + Create snapshot
                        </Button>
                      </div>

                      {versions.map((v) => {
                        const label =
                          (v.commit?.trim() || 'Snapshot') +
                          ' · ' +
                          (() => {
                            const now = Date.now();
                            const then = new Date(v.updated_at || v.created_at).getTime();
                            const s = Math.max(1, Math.floor((now - then) / 1000));
                            if (s < 60) return `${s}s ago`;
                            const m = Math.floor(s / 60);
                            if (m < 60) return `${m}m ago`;
                            const h = Math.floor(m / 60);
                            if (h < 24) return `${h}h ago`;
                            const d = Math.floor(h / 24);
                            return `${d}d ago`;
                          })();

                        return (
                          <button
                            key={v.id}
                            onClick={async () => {
                              setVersionsOpen(false);
                              await restoreVersionFromTemplates(v.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-800 text-sm"
                          >
                            {label}
                          </button>
                        );
                      })}

                      <div className="p-2 border-t border-gray-800 flex items-center justify-between text-xs">
                        <span className="text-gray-400">{versions.length} total</span>
                        <a
                          className="text-purple-300 hover:underline"
                          href={`/admin/templates/list?versions=all&q=${encodeURIComponent(baseSlug((template as any).slug || template.template_name || ''))}`}
                        >
                          View in list →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button size="sm" variant="secondary" onClick={handleSaveClick}>Save</Button>

            <div className="relative">
              <Button size="sm" variant="secondary" onClick={() => handleSaveAs('site')} disabled={overlayOpen}>
                Duplicate Site
              </Button>
            </div>
          </div>
        </div>

        {saveWarnings.length > 0 && (
          <div className="mt-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-xs px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-[2px] flex-none" />
            <div className="flex-1 space-y-1">{saveWarnings.map((w, i) => (<div key={i}>{w.message}</div>))}</div>
            <button aria-label="Dismiss warnings" onClick={() => setSaveWarnings([])} className="p-1 rounded hover:bg-yellow-500/20">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <AsyncGifOverlay open={overlayOpen} message={overlayMsg} />
    </>
  );
}
