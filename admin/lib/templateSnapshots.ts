'use client';

import type { Template } from '@/types/template';
import { supabase } from '@/admin/lib/supabaseClient';
import { baseSlug, randSuffix, normalizeForSnapshot } from '@/lib/editor/templateUtils';

export async function createSnapshotFromTemplate(template: Template, commit_message = 'Snapshot') {
  const normalized = normalizeForSnapshot(template);
  const bSlug = baseSlug((normalized as any).slug || normalized.template_name);
  let newSlug = `${bSlug}-${randSuffix()}`;

  const row: any = {
    template_name: newSlug,
    slug: newSlug,
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
    archived: true,
  };

  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase
      .from('templates')
      .insert(row)
      .select('id, slug, commit, created_at, updated_at, archived, data, header_block, footer_block, color_mode')
      .single();

    if (!error) return data!;
    if (error.code !== '23505') throw error;
    newSlug = `${bSlug}-${randSuffix()}`;
    row.template_name = newSlug;
    row.slug = newSlug;
  }
  throw new Error('Could not create a unique snapshot slug');
}

export async function loadVersionRow(versionId: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('data, header_block, footer_block, color_mode')
    .eq('id', versionId)
    .maybeSingle();
  if (error || !data) throw error || new Error('Missing version');
  return data;
}
