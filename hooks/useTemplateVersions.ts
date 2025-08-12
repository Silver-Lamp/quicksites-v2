'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { baseSlug } from '@/lib/editor/templateUtils';

export type VersionRow = {
  id: string;
  slug: string | null;
  commit: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived: boolean | null;
  data: any;
  header_block: any;
  footer_block: any;
  color_mode: 'light' | 'dark' | null;
};

export function useTemplateVersions(slugOrName: string, currentId: string | null) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const bSlug = baseSlug(slugOrName || '');
    const selectCols =
      'id, slug, commit, created_at, updated_at, archived, data, header_block, footer_block, color_mode';

    let res = await supabase
      .from('templates')
      .select(selectCols)
      .eq('base_slug', bSlug)
      .order('updated_at', { ascending: false })
      .limit(50);

    // Fallback when base_slug column doesn’t exist
    if ((res as any)?.error?.code === '42703') {
      res = await supabase
        .from('templates')
        .select(selectCols)
        .or(`slug.eq.${bSlug},slug.ilike.${bSlug}-%`)
        .order('updated_at', { ascending: false })
        .limit(50);
    }

    const { data, error } = res;
    if (error) {
      setError(error.message);
      setVersions([]);
      return;
    }

    const rows = (data ?? []).filter((r) => r.id !== currentId);
    setError(null);
    setVersions(rows as VersionRow[]);
  }, [slugOrName, currentId]);

  useEffect(() => {
    load();
  }, [load]);

  return { versions, error, reloadVersions: load };
}
