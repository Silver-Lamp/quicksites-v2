// components/admin/templates/template-action-toolbar.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';
import type { Template } from '@/types/template';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import AsyncGifOverlay from '@/components/ui/async-gif-overlay';

type Props = {
  template: Template;
  autosaveStatus?: string;
  /** If provided, will be called with an optional sanitized Template */
  onSaveDraft?: (maybeSanitized?: Template) => void;
  onUndo: () => void;
  onRedo: () => void;
};

/* ---------------------------------------------
   Helpers: keep header/footer single-source-of-truth
   and strip any stray header/footer from page bodies
---------------------------------------------- */
const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

async function resolveSlugForId(id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('slug')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[Duplicate] could not resolve slug for id:', id, error);
    return null;
  }
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
  return {
    ...page,
    content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)),
  };
}

/** Normalize for duplication/snapshot:
 *  - ensure headerBlock/footerBlock live at root
 *  - remove header/footer blocks from page bodies
 *  - keep pages synced in both places
 */
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

  // Respect color_mode precedence (top-level wins)
  const topMode = tpl?.color_mode;
  const nestedMode = tpl?.data?.color_mode;
  if (topMode === 'light' || topMode === 'dark') {
    // keep as-is
  } else if (nestedMode === 'light' || nestedMode === 'dark') {
    tpl.color_mode = nestedMode;
  }

  return tpl as Template;
}

/** Build the payload we send to createSharedPreview so viewers have header/footer */
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

export function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState('Draft');
  const [versions, setVersions] = useState<any[]>([]);
  const [dupMenuOpen, setDupMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Overlay state for async actions (e.g., duplicate)
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMsg, setOverlayMsg] = useState<string>('Working…');

  useEffect(() => {
    if (!template?.template_name) return;

    let mounted = true;
    supabase
      .from('template_versions')
      .select('id, commit_message, created_at')
      .eq('template_name', template.template_name)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.warn('[Toolbar] Versions unavailable:', error?.message || error);
          setVersions([]);
          return;
        }
        setVersions(data ?? []);
      })
      // .catch((err: any) => {
      //   if (!mounted) return;
      //   console.warn('[Toolbar] Versions fetch failed:', err?.message || err);
      //   setVersions([]);
      // });

    setStatus(template?.published ? 'Published' : 'Draft');

    return () => {
      mounted = false;
    };
  }, [template?.template_name, template?.published]);

  useEffect(() => {
    const handleHotkey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 's') {
        e.preventDefault();
        handleSaveClick();
      }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleShare();
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template]);

  // close the duplicate menu on outside click
  useEffect(() => {
    if (!dupMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setDupMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dupMenuOpen]);

  const handleSaveAs = async (type: 'template' | 'site') => {
    try {
      setOverlayMsg(type === 'site' ? 'Creating your site…' : 'Creating your template…');
      setOverlayOpen(true);

      const normalized = normalizeForSnapshot(template);
      const created = await saveAsTemplate(normalized, type); // returns { id, slug } | null

      if (!created) {
        toast.error('Failed to duplicate');
        return;
      }

      // Prefer slug returned by the insert; otherwise resolve by id
      const slug = created.slug ?? (created.id ? await resolveSlugForId(created.id) : null);

      if (slug) {
        router.push(`/template/${slug}/edit`);
      } else {
        // fallback: take them to list so they can find it
        router.push('/admin/templates');
      }

      toast.success(`Duplicated as ${type}`);
    } catch (e) {
      console.error('[Duplicate] failed:', e);
      toast.error('Failed to duplicate');
    } finally {
      setDupMenuOpen(false);
      setOverlayOpen(false);
    }
  };

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

  /** Scroll to a block by id if it exists in the DOM */
  const scrollToBlock = (blockId?: string) => {
    if (!blockId) return;
    const el = document.getElementById(`block-${blockId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSaveClick = () => {
    try {
      // Normalize BEFORE validation; ensures header/footer at root & pages clean
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

      onSaveDraft?.(check.data as Template);
      // toast.success('Saved!');
    } catch (err) {
      console.error('❌ Exception during validation:', err);
      toast.error('Validation crashed — see console.');
    }
  };

  const restoreVersion = async (versionId: string) => {
    const { data, error } = await supabase
      .from('template_versions')
      .select('snapshot')
      .eq('id', versionId)
      .single();

    if (error || !data?.snapshot) {
      console.error('[Toolbar] Failed to load version', error);
      toast.error('Failed to load version');
      return;
    }

    if (confirm('Restore this version? This will overwrite the current draft.')) {
      const snap = data.snapshot;
      const restored: Template = {
        ...template,
        ...(snap.headerBlock ? { headerBlock: snap.headerBlock } : {}),
        ...(snap.footerBlock ? { footerBlock: snap.footerBlock } : {}),
        data: snap.data ?? snap,
      };
      const normalized = normalizeForSnapshot(restored);
      onSaveDraft?.(normalized);
      toast.success('Version restored!');
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-gray-900 border border-gray-700 px-6 py-3 shadow-xl max-w-5xl w-[95%] flex justify-between items-center text-white opacity-80">
        <div className="text-sm font-medium flex gap-4 items-center">
          <span
            className={`text-xs px-2 py-1 rounded ${
              status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'
            }`}
          >
            {status}
          </span>
          {autosaveStatus && (
            <span className="text-xs text-gray-400 italic">💾 {autosaveStatus}</span>
          )}
          <Button size="icon" variant="ghost" onClick={onUndo} title="Undo (⌘Z)">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRedo} title="Redo (⇧⌘Z)">
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={handleSaveClick}>
            Save
          </Button>

          {/* Simple “Duplicate Site” button (no split menu) */}
          <div className="relative" ref={menuRef}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleSaveAs('site')}
              disabled={overlayOpen}
            >
              Duplicate Site
            </Button>
          </div>
        </div>
      </div>

      <AsyncGifOverlay open={overlayOpen} message={overlayMsg} />
    </>
  );
}
