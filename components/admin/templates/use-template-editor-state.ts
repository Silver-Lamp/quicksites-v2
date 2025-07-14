import { useState, useEffect } from 'react';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { useTemplateMeta } from '@/hooks/useTemplateMeta';
import { useTemplateJsonSync } from '@/hooks/useTemplateJsonSync';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { useTemplateSave } from '@/hooks/useTemplateSave';
import type { Snapshot, Template } from '@/types/template';
import toast from 'react-hot-toast';
import { validateBlock } from '@/lib/validateBlock';
import { Block } from '@/types/blocks';
import { validateTemplateBlocks } from '@/hooks/validateTemplateBlocks';
import { fixTemplatePages } from '@/lib/fixBlockDefaults';

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
  const [blockErrors, setBlockErrors] = useState<Record<string, string[]>>({});

  const applyDefaults = (tpl: Partial<Template>): Snapshot => {
    const snapshot: Snapshot = {
      template_name: 'template_name' in tpl ? tpl.template_name || templateName : templateName,
      layout: tpl.layout || 'standard',
      color_scheme: tpl.color_scheme || 'neutral',
      theme: tpl.theme || 'default',
      brand: tpl.brand || 'default',
      commit: 'commit' in tpl ? tpl.commit || '' : '',
      id: tpl.id || crypto.randomUUID(),
      slug: tpl.slug || '',
      industry: tpl.industry || 'default',
      data: fixTemplatePages(tpl.data || { pages: [] }),
    };

    const errors: Record<string, string[]> = {};
    for (const page of snapshot.data.pages) {
      for (const block of page.content_blocks) {
        const errorList = validateBlock(block as Block);
        if (errorList.length) {
          errors[block._id || ''] = errorList;
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
    applyDefaults(initialData ? normalizeTemplate(initialData as Template) : fallback)
  );

  const [isCreating, setIsCreating] = useState(!initialData);
  const [isRenaming, setIsRenaming] = useState(false);

  const { rawJson, setRawJson, livePreviewData } = useTemplateJsonSync(template.data);
  const { inputValue, setInputValue, slugPreview, nameExists } = useTemplateMeta(template.template_name, template.id);

  const autosave = useAutosaveTemplate(template, rawJson);

  useEffect(() => {
    if (!initialData && isCreating && template?.slug) {
      const timeout = setTimeout(() => {
        alert('would have redirected to ' + window.location.href + '/admin/templates/' + template.id);
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [isCreating, initialData, template]);

  const handleSaveDraft = () => {
    const { isValid, errors } = validateTemplateBlocks(template as Template);

    if (!isValid) {
      console.log('errors', errors);
      setBlockErrors(errors);
      const firstInvalidId = Object.keys(errors)[0];
      const el = document.getElementById(`block-${firstInvalidId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('Please fix validation errors before saving.');
      return;
    }

    localStorage.setItem(`draft-${template.id}`, rawJson);
    toast.success('Draft saved');
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
