// hooks/useTemplateMeta.ts
import { useEffect, useState } from 'react';
import { debounce } from 'lodash';
import { stripTimestampFromName, slugify } from '@/lib/utils/slug';
import { supabase } from '@/lib/supabase';

export function useTemplateMeta(name: string, currentId?: string) {
  const clean = stripTimestampFromName(name);
  const [inputValue, setInputValue] = useState(clean);
  const [slugPreview, setSlugPreview] = useState('');
  const [nameExists, setNameExists] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSlugPreview(slugify(inputValue));
    }, 150);
    return () => clearTimeout(handler);
  }, [inputValue]);

  useEffect(() => {
    if (!inputValue.trim()) return;
    const check = debounce(async () => {
      const { data } = await supabase
        .from('templates')
        .select('id')
        .eq('template_name', inputValue.trim())
        .neq('id', currentId)
        .maybeSingle();
      setNameExists(!!data);
    }, 300);
    check();
    return () => check.cancel?.();
  }, [inputValue, currentId]);

  return {
    inputValue,
    setInputValue,
    slugPreview,
    nameExists,
  };
}
