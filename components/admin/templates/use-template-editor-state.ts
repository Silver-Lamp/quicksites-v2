// components/admin/templates/use-template-editor-state.ts
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';

import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { useTemplateMeta } from '@/hooks/useTemplateMeta';
import { useTemplateJsonSync } from '@/hooks/useTemplateJsonSync';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import { handleTemplateSave } from '@/admin/lib/handleTemplateSave';

import type { Snapshot, Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import { validateBlock } from '@/lib/validateBlock';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { fixTemplatePages } from '@/lib/fixBlockDefaults';
import { ZodError } from 'zod';

// ------------------------------
// helpers
// ------------------------------
function generateSlug(base: string) {
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();
}
function generateUniqueSlug(base: string) {
  return `${generateSlug(base)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Make sure pages exist in both places and are identical. */
function withSyncedPages<T extends Partial<Template>>(tpl: T): Template {
  const dataPages = (tpl as any)?.data?.pages;
  const rootPages = (tpl as any)?.pages;
  const pages = Array.isArray(dataPages)
    ? dataPages
    : Array.isArray(rootPages)
    ? rootPages
    : [];

  const fixed = fixTemplatePages({ pages } as any);

  return {
    ...(tpl as any),
    pages: fixed.pages,
    data: { ...(tpl as any).data, pages: fixed.pages },
  } as Template;
}

/** Validate blocks once on load and keep an error map. */
function collectBlockErrors(tpl: Template): Record<string, BlockValidationError[]> {
  const errs: Record<string, BlockValidationError[]> = {};
  for (const page of tpl?.data?.pages ?? []) {
    for (const block of page.content_blocks ?? []) {
      const problems = validateBlock(block as Block);
      if (problems.length) errs[block._id || crypto.randomUUID()] = problems as any;
    }
  }
  return errs;
}

/**
 * One-shot creator that ALWAYS serializes the full DB-safe template.
 * This avoids Zod "Required" errors on id/template_name/slug/... during first save.
 */
function makeOneShotSave(
  _handleTemplateSave: typeof import('@/admin/lib/handleTemplateSave').handleTemplateSave,
  getCurrentTemplate: () => Template,
  guardedSetTemplate: (tpl: Template) => void
) {
  let inFlight: Promise<Template> | null = null;

  return () => {
    if (inFlight) return inFlight;

    const fullDbSafe = prepareTemplateForSave(getCurrentTemplate());
    const payload = JSON.stringify(fullDbSafe);

    inFlight = new Promise<Template>((resolve, reject) => {
      _handleTemplateSave({
        rawJson: payload,
        mode: 'template',
        onSuccess: (updated) => {
          // ensure local state has the DB id/slug/etc.
          guardedSetTemplate(updated);
          resolve(updated);
        },
        onError: (err) => {
          inFlight = null; // allow retry
          reject(err as any);
        },
      });
    });

    return inFlight;
  };
}

// ------------------------------
// hook
// ------------------------------
export function useTemplateEditorState({
  templateName,
  initialData,
  onRename,
  onSaveDraft,
  colorMode,
}: {
  templateName: string;
  initialData?: Snapshot | Template;
  onRename?: (newName: string) => void;
  onSaveDraft?: (rawJson: string) => void;
  colorMode: 'light' | 'dark';
}) {
  const fallback = createEmptyTemplate(templateName);

  // 1) Build a normalized + defaulted snapshot from either initialData or fallback
  const initialSnapshot: Template = useMemo(() => {
    const baseNorm = normalizeTemplate({
      ...(initialData || fallback),
      template_name: (initialData as any)?.template_name || fallback.template_name || 'Untitled',
      slug:
        (initialData as any)?.slug ||
        generateUniqueSlug((initialData as any)?.template_name || templateName || 'template'),
      industry: (initialData as any)?.industry || 'general',
      meta: {
        title: (initialData as any)?.meta?.title || (initialData as any)?.template_name || 'Untitled',
        description:
          (initialData as any)?.meta?.description || 'Auto-generated template description',
        ...(initialData as any)?.meta,
      },
      layout: (initialData as any)?.layout || 'standard',
      color_scheme: (initialData as any)?.color_scheme || 'neutral',
      theme: (initialData as any)?.theme || 'default',
      brand: (initialData as any)?.brand || 'default',
      commit: (initialData as any)?.commit || '',
      id: (initialData as any)?.id || crypto.randomUUID(),
      is_site: (initialData as any)?.is_site || false,
      published: (initialData as any)?.published || false,
      color_mode: (initialData as any)?.color_mode || colorMode,
      data: fixTemplatePages(((initialData as any)?.data || { pages: [] }) as any),
    } as Partial<Template>);

    return withSyncedPages(baseNorm);
  }, [initialData, fallback, templateName, colorMode]);

  // 2) State
  const [template, _setTemplate] = useState<Template>(initialSnapshot);
  const [blockErrors, setBlockErrors] = useState<Record<string, BlockValidationError[]>>(
    collectBlockErrors(initialSnapshot),
  );
  const [isCreating] = useState(!initialData);
  const [isRenaming, setIsRenaming] = useState(false);
  const collapseWarnedRef = useRef(false);

  // 3) JSON syncing + autosave helpers
  const { rawJson, setRawJson, livePreviewData } = useTemplateJsonSync(template.data || {});
  const { inputValue, setInputValue, slugPreview, nameExists } = useTemplateMeta(
    template.template_name,
    template.id,
  );
  const autosave = useAutosaveTemplate(template, rawJson);

  // 4) Keep JSON panel prettified on first creation, without stripping pages
  const hasPrettified = useRef(false);
  useEffect(() => {
    if (!initialData && template && !hasPrettified.current) {
      hasPrettified.current = true;
      const dbSafe = prepareTemplateForSave(template); // keeps pages in data
      const layoutOnly = cleanTemplateDataStructure(dbSafe);
      setRawJson(JSON.stringify(layoutOnly, null, 2));
    }
  }, [initialData, template, setRawJson]);

  // 5) If initialData changes (navigating, reloading), rehydrate but DO NOT drop pages
  useEffect(() => {
    if (!initialData) return;
    const next = withSyncedPages(normalizeTemplate(initialData as Template));
    guardedSetTemplate(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  // 6) Guarded setter prevents accidental page collapse + re-collects errors
  function guardedSetTemplate(next: Template) {
    const prevCount =
      template?.data?.pages?.length ?? (template as any)?.pages?.length ?? 0;
    const nextCount = next?.data?.pages?.length ?? (next as any)?.pages?.length ?? 0;

    if (prevCount > 1 && nextCount === 0 && !collapseWarnedRef.current) {
      collapseWarnedRef.current = true;
      console.warn('[⚠️ useTemplateEditorState] Pages collapsed unexpectedly.', {
        from: prevCount,
        to: nextCount,
        next,
      });
    }

    const synced = withSyncedPages(next);
    _setTemplate(synced);
    setBlockErrors(collectBlockErrors(synced));
  }

  // 6.5) One-shot saver + auto-create on mount for new templates
  const saveOnce = useRef<(() => Promise<Template>) | null>(null);
  const didInitialCreate = useRef(false);

  useEffect(() => {
    saveOnce.current = makeOneShotSave(
      handleTemplateSave,
      () => template,
      guardedSetTemplate
    );
  }, [template]);

  // Auto-create a DB row when a brand-new editor opens
  useEffect(() => {
    if (!isCreating) return;
    if (didInitialCreate.current) return;

    didInitialCreate.current = true;
    saveOnce.current?.()
      .catch((e) => {
        console.warn('[initial create] failed; will retry later:', e);
        didInitialCreate.current = false;
      });
  }, [isCreating]);

  // 7) Save draft via API
  const handleSaveDraft = () => {
    // If the JSON panel is empty, still send a full DB-safe payload.
    const payload =
      rawJson && rawJson.trim()
        ? rawJson
        : JSON.stringify(prepareTemplateForSave(template), null, 2);

    handleTemplateSave({
      rawJson: payload,
      mode: 'template',
      onSuccess: (updated: Template) => {
        guardedSetTemplate(updated);
        localStorage.setItem(`draft-${updated.id}`, payload);
        // toast.success('Draft saved');
        onSaveDraft?.(payload);
      },
      onError: (err: ZodError | string) => {
        console.warn('Save failed', err);
        toast.error('Save failed');
      },
    });
  };

  // 8) Rename flow — ensures a persisted row exists, retries once on 404
  const handleRename = async () => {
    const newName = inputValue.trim();
    if (newName.length < 3) return toast.error('Name must be at least 3 chars.');
    if (!newName) return;

    try {
      // ensure persisted row
      toast.loading('Creating draft…', { id: 'firstsave' });
      const ensured = await (saveOnce.current?.() ?? Promise.resolve(template));
      toast.dismiss('firstsave');

      const templateId = ensured.id;

      const tryRename = async () => {
        const res = await fetch('/api/templates/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: templateId, newName }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(json?.error || 'Failed to rename') as any;
          err.status = res.status;
          throw err;
        }
      };

      try {
        await tryRename();
      } catch (e: any) {
        if (e?.status === 404) {
          const again = await (saveOnce.current?.() ?? Promise.resolve(template));
          guardedSetTemplate(again);
          await tryRename();
        } else {
          throw e;
        }
      }

      // optimistic local update
      const nextSlug = generateSlug(newName);
      guardedSetTemplate({
        ...ensured,
        template_name: newName,
        slug: nextSlug || ensured.slug,
        meta: { ...ensured.meta, title: newName },
      });

      onRename?.(newName);
      toast.success('Renamed');
    } catch (err: any) {
      console.error('[rename] failed', err);
      toast.error(err?.message || 'Rename failed');
    } finally {
      setIsRenaming(false);
    }
  };

  // 9) Public setter that ALWAYS keeps pages mirrored
  const setTemplate = (updater: Template | ((prev: Template) => Template)) => {
    if (typeof updater === 'function') {
      _setTemplate(prev => {
        const next = withSyncedPages((updater as any)(prev));
        const prevCount =
          prev?.data?.pages?.length ?? (prev as any)?.pages?.length ?? 0;
        const nextCount =
          next?.data?.pages?.length ?? (next as any)?.pages?.length ?? 0;
        if (prevCount > 1 && nextCount === 0 && !collapseWarnedRef.current) {
          collapseWarnedRef.current = true;
          console.warn('[⚠️ useTemplateEditorState] Pages collapsed unexpectedly (fn).', {
            from: prevCount,
            to: nextCount,
            next,
          });
        }
        const synced = withSyncedPages(next);
        setBlockErrors(collectBlockErrors(synced));
        return synced;
      });
    } else {
      guardedSetTemplate(updater as Template);
    }
  };

  return {
    template,
    setTemplate,
    rawJson,
    setRawJson,
    livePreviewData,
    autosave,
    isCreating,
    isRenaming,
    setIsRenaming,
    handleRename,
    inputValue,
    setInputValue,
    slugPreview,
    handleSaveDraft,
    nameExists,
    blockErrors,
    setBlockErrors,
  };
}
