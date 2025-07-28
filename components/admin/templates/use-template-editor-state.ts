import { useState, useEffect, useRef } from 'react';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { useTemplateMeta } from '@/hooks/useTemplateMeta';
import { useTemplateJsonSync } from '@/hooks/useTemplateJsonSync';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { Snapshot, Template } from '@/types/template';
import toast from 'react-hot-toast';
import { validateBlock } from '@/lib/validateBlock';
import { Block } from '@/types/blocks';
import { BlockValidationError, validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { fixTemplatePages } from '@/lib/fixBlockDefaults';
import { handleTemplateSave } from '@/admin/lib/handleTemplateSave';
import { ZodError } from 'zod';

function generateSlug(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

function generateUniqueSlug(base: string) {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${generateSlug(base)}-${suffix}`;
}

export function useTemplateEditorState({
  templateName,
  initialData,
  onRename,
}: {
  templateName: string;
  initialData?: Snapshot | Template;
  onRename?: (newName: string) => void;
}) {
  const fallback = createEmptyTemplate(templateName);
  const [blockErrors, setBlockErrors] = useState<Record<string, BlockValidationError[]>>({});
  const hasPrettified = useRef(false);

  const applyDefaults = (tpl: Partial<Template>): Snapshot => {
    const base: Partial<Template> = normalizeTemplate({
      ...tpl,
      template_name: tpl.template_name || 'Untitled',
      slug:
        tpl.slug ||
        generateUniqueSlug(tpl.template_name || templateName || 'template'),
      industry: tpl.industry || 'general',
      meta: {
        title: tpl.meta?.title || tpl.template_name || 'Untitled',
        description: tpl.meta?.description || 'Auto-generated template description',
        ...tpl.meta,
      },
    });

    const snapshot: Snapshot = {
      ...base,
      layout: base.layout || 'standard',
      color_scheme: base.color_scheme || 'neutral',
      theme: base.theme || 'default',
      brand: base.brand || 'default',
      commit: base.commit || '',
      id: base.id || crypto.randomUUID(),
      data: fixTemplatePages(base.data || { pages: [] }),
      is_site: base.is_site || false,
      published: base.published || false,
    } as Snapshot;

    const errors: Record<string, BlockValidationError[]> = {};
    for (const page of snapshot.data.pages) {
      for (const block of page.content_blocks) {
        const errorList = validateBlock(block as Block);
        if (errorList.length) {
          errors[block._id || ''] = errorList as unknown as BlockValidationError[];
          if (process.env.NODE_ENV === 'development') {
            console.warn('[TemplateEditor] Block schema validation failed for:', block.type, errorList);
          }
        }
      }
    }

    if (Object.keys(errors).length) {
      console.log('blockErrors', errors);
    }

    setBlockErrors(errors);
    return snapshot;
  };

  const [template, setTemplate] = useState(() =>
    applyDefaults(initialData || fallback)
  );

  const [isCreating, setIsCreating] = useState(!initialData);
  const [isRenaming, setIsRenaming] = useState(false);

  const { rawJson, setRawJson, livePreviewData } = useTemplateJsonSync(template.data);
  const { inputValue, setInputValue, slugPreview, nameExists } = useTemplateMeta(template.template_name, template.id);

  const autosave = useAutosaveTemplate(template, rawJson);

  // Auto-prettify + normalize JSON after new template creation
  useEffect(() => {
    if (!initialData && template && !hasPrettified.current) {
      hasPrettified.current = true;
      const normalized = normalizeTemplate(template);
      setRawJson(JSON.stringify(normalized, null, 2));
    }
  }, [initialData, template]);

  // Simulated redirect after creation
  // useEffect(() => {
  //   if (!initialData && isCreating && template?.slug) {
  //     const timeout = setTimeout(() => {
  //       alert('would have redirected to ' + window.location.href + '/admin/templates/' + template.id);
  //     }, 1200);
  //     return () => clearTimeout(timeout);
  //   }
  // }, [isCreating, initialData, template]);

  const handleSaveDraft = () => {
    handleTemplateSave({
      rawJson,
      mode: 'template',
      onSuccess: (updated: Template) => {
        setTemplate(updated);
        localStorage.setItem(`draft-${updated.id}`, rawJson);
        toast.success('Draft saved');
      },
      onError: (err: ZodError | string) => {
        console.warn('Block errors:', err);
      },
    });
  };

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

    setTemplate((prev) => ({ ...prev, template_name: newName }));
    onRename?.(newName);
    setIsRenaming(false);
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
