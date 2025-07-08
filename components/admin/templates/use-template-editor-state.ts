import { useState, useEffect, useMemo } from 'react';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { generateUniqueTemplateName, slugify, stripTimestampFromName } from '@/lib/utils/slug';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import debounce from 'lodash.debounce';
import type { TemplateData } from '@/types/template';

export function useTemplateEditorState({ templateName, initialData, onRename }: {
  templateName: string;
  initialData?: any;
  onRename?: (newName: string) => void;
}) {
  const [template, setTemplate] = useState<any>({
    id: initialData?.id || '',
    name: templateName,
    layout: 'default',
    color_scheme: '',
    commit: '',
    industry: '',
    theme: '',
    brand: '',
    data: { pages: [] },
  });

  const [rawJson, setRawJson] = useState('');
  const [livePreviewData, setLivePreviewData] = useState<TemplateData>({ pages: [] });
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [slugPreview, setSlugPreview] = useState('');

  const baseName = templateName || 'new-template';
  const uniqueName = generateUniqueTemplateName(baseName);
  const cleanName = stripTimestampFromName(uniqueName);
  const [inputValue, setInputValue] = useState(cleanName);

  const debouncedSetPendingName = useMemo(
    () => debounce((val: string) => setInputValue(val), 100),
    []
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setSlugPreview(slugify(inputValue));
    }, 150);
    return () => clearTimeout(handler);
  }, [inputValue]);

  const sampleBlocks = [
    { type: 'text', content: { text: 'Welcome to the playground!' } },
    { type: 'image', content: { url: 'https://placekitten.com/800/400', alt: 'A cute kitten' } },
  ];

  const autosave = useAutosaveTemplate(template, rawJson);

  const createNewTemplate = async () => {
    const fallbackData = {
      pages: [
        {
          id: 'index',
          slug: 'index',
          title: 'Sample Page',
          content_blocks: sampleBlocks,
        },
      ],
    };

    const safeName = generateUniqueTemplateName(templateName || 'new-template');
    const safeSlug = slugify(safeName);

    setIsCreating(true);
    const { data, error } = await supabase
      .from('templates')
      .insert({
        template_name: safeName,
        slug: safeSlug,
        layout: 'default',
        data: fallbackData,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error('Failed to create new template');
      setIsCreating(false);
      console.error('Insert error:', error);
      return;
    }

    window.location.href = `/admin/templates/${data.slug}`;
  };

  useEffect(() => {
    if (template.id) return;

    const fallbackData = {
      pages: [
        {
          id: 'index',
          slug: 'index',
          title: 'Sample Page',
          content_blocks: sampleBlocks,
        },
      ],
    };

    if (initialData) {
      const normalized = normalizeTemplate({
        ...initialData,
        data: initialData.data ?? fallbackData,
      });
      setTemplate(normalized);
      setRawJson(JSON.stringify(normalized.data, null, 2));
      setLivePreviewData(normalized.data);
    } else {
      createNewTemplate();
    }
  }, [initialData, template.id]);

  useEffect(() => {
    setRawJson(JSON.stringify(template.data, null, 2));
  }, [template.data]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(rawJson);
      setLivePreviewData(parsed);
      setTemplate((prev: any) => ({ ...prev, data: parsed }));
    } catch {
      // ignore
    }
  }, [rawJson]);

  const handleSaveDraft = () => {
    localStorage.setItem(`draft-${template.id}`, rawJson);
    toast.success('Draft saved manually');
  };

  const handleRename = async () => {
    const newName = inputValue.trim();
    if (newName.length < 3) {
      toast.error('Name must be at least 3 characters.');
      return;
    }
    if (newName === template.name) {
      setIsRenaming(false);
      return;
    }
    let res: Response;
    try {
      res = await fetch('/api/templates/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, newName }),
      });
    } catch {
      toast.error('Network error while renaming');
      return;
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      toast.error('Unexpected response format');
      return;
    }
    if (!res.ok) {
      toast.error(data?.error || 'Failed to rename template');
      return;
    }
    // toast.success('Template renamed!');
    setTemplate((prev: any) => ({ ...prev, name: newName }));
    setIsRenaming(false);
    if (onRename) onRename(newName);
  };

  const [nameExists, setNameExists] = useState(false);

  useEffect(() => {
    if (!inputValue.trim() || inputValue === template.name) return;
    const checkName = debounce(async () => {
      const { data } = await supabase
        .from('templates')
        .select('id')
        .eq('template_name', inputValue.trim())
        .neq('id', template.id)
        .maybeSingle();

      setNameExists(!!data);
      if (!data) {
        setNameExists(false);
      }
    }, 300);

    checkName();
    return () => checkName.cancel?.();
  }, [inputValue, template.id, template.name]);

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
