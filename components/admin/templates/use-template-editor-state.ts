// components/admin/templates/use-template-editor-state.ts
import { useState, useEffect } from 'react';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { useTemplateMeta } from '@/hooks/useTemplateMeta';
import { useTemplateJsonSync } from '@/hooks/useTemplateJsonSync';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { useTemplateSave } from '@/hooks/useTemplateSave';
import type { Snapshot } from '@/types/template';
import toast from 'react-hot-toast';

export function useTemplateEditorState({
  templateName,
  initialData,
  onRename,
}: {
  templateName: string;
  initialData?: Snapshot;
  onRename?: (newName: string) => void;
}) {
  const fallback = createEmptyTemplate(templateName);
  const [template, setTemplate] = useState(() =>
    initialData ? normalizeTemplate(initialData) : fallback
  );
  const [isCreating, setIsCreating] = useState(!initialData);
  const [isRenaming, setIsRenaming] = useState(false);

  const { rawJson, setRawJson, livePreviewData } = useTemplateJsonSync(template.data);
  const { inputValue, setInputValue, slugPreview, nameExists } = useTemplateMeta(template.name, template.id);

  const autosave = useAutosaveTemplate(template, rawJson);

  useEffect(() => {
    if (!initialData && isCreating && template?.slug) {
      const timeout = setTimeout(() => {
        window.location.href = `/admin/templates/${template.slug}`;
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [isCreating, initialData, template]); // ✅ Track the whole object instead of `template.slug`
  
  

  const handleSaveDraft = () => {
    localStorage.setItem(`draft-${template.id}`, rawJson);
    toast.success('Draft saved');
  };

  const handleRename = async () => {
    const newName = inputValue.trim();
    if (newName.length < 3) return toast.error('Name must be at least 3 chars.');
    if (newName === template.name) return setIsRenaming(false);

    const res = await fetch('/api/templates/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: template.id, newName }),
    });
    const json = await res.json();
    if (!res.ok) return toast.error(json?.error || 'Failed to rename');

    setTemplate((prev) => ({ ...prev, name: newName }));
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
  };
}
