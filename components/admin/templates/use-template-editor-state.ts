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
  // Prefer canonical data.pages, else legacy pages, else []
  const dataPages = (tpl as any)?.data?.pages;
  const rootPages = (tpl as any)?.pages;
  const pages = Array.isArray(dataPages)
    ? dataPages
    : Array.isArray(rootPages)
    ? rootPages
    : [];

  const fixed = fixTemplatePages({ pages } as any); // ensures shape, block defaults, etc.

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

    // ensure mirrored pages
    const synced = withSyncedPages(baseNorm);

    return synced;
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
  }, [initialData?.id]); // rehydrate when switching templates

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
      // In dev you could throw to catch the offender:
      // throw new Error('Pages collapsed unexpectedly');
    }

    const synced = withSyncedPages(next);
    _setTemplate(synced);
    setBlockErrors(collectBlockErrors(synced));
  }

  // 7) Save draft via API
  const handleSaveDraft = () => {
    handleTemplateSave({
      rawJson,
      mode: 'template',
      onSuccess: (updated: Template) => {
        guardedSetTemplate(updated);
        localStorage.setItem(`draft-${updated.id}`, rawJson);
        toast.success('Draft saved');
        onSaveDraft?.(rawJson);
      },
      onError: (err: ZodError | string) => {
        console.warn('Save failed', err);
        toast.error('Save failed');
      },
    });
  };

  // 8) Rename flow
  const handleRename = async () => {
    const newName = inputValue.trim();
    if (newName.length < 3) return toast.error('Name must be at least 3 chars.');
    if (newName === template.template_name) return setIsRenaming(false);

    const res = await fetch('/api/templates/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: template.id, newName }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error || 'Failed to rename');

    guardedSetTemplate({ ...template, template_name: newName });
    onRename?.(newName);
    setIsRenaming(false);
  };

  // 9) Public setter that ALWAYS keeps pages mirrored
  const setTemplate = (updater: Template | ((prev: Template) => Template)) => {
    if (typeof updater === 'function') {
      _setTemplate(prev => {
        const next = withSyncedPages((updater as any)(prev));
        // same guard + errors as guardedSetTemplate
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
