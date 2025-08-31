// admin/lib/templateSnapshots.ts
'use client';

import type { Template } from '@/types/template';
import { supabase } from '@/admin/lib/supabaseClient';
import { baseSlug, randSuffix, normalizeForSnapshot } from '@/lib/editor/templateUtils';

/** Create a snapshot row (now marks both archived + is_version=true). */
export async function createSnapshotFromTemplate(
  template: Template,
  commit_message = 'Snapshot'
) {
  const normalized = normalizeForSnapshot(template);
  const bSlug = baseSlug((normalized as any).slug || normalized.template_name);
  let newSlug = `${bSlug}-${randSuffix()}`;

  // get current user for tenancy fallbacks
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id ?? null;

  const row: any = {
    template_name: newSlug,
    slug: newSlug,
    base_slug: bSlug,                  // ← helpful for backfills/joins if you store it
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
    is_version: true,

    // 🔑 TENANCY FIELDS — CRITICAL FOR RLS
    owner_id: (template as any).owner_id ?? uid,
    last_editor: uid,
    claimed_by: (template as any).claimed_by ?? null, // optional if you use it in policies
  };

  for (let i = 0; i < 3; i++) {
    const trace = `snapshot:${newSlug}:${Date.now()}`;
    console.group(`QSITES[snapshot] create trace=${trace}`);
    console.log('insert row.slug', row.slug);

    const { data, error, status } = await supabase
      .from('templates')
      .insert(row)
      .select(
        'id, slug, commit, created_at, updated_at, archived, is_version, owner_id, last_editor, data, header_block, footer_block, color_mode'
      )
      .single();

    console.log('status', status);
    if (error) {
      console.error('insert error', error);
      if (error.code !== '23505') {
        console.groupEnd();
        throw error;
      }
      // slug collision → retry
      newSlug = `${baseSlug(bSlug)}-${randSuffix()}`;
      row.template_name = newSlug;
      row.slug = newSlug;
      console.warn('slug collision — retrying with', newSlug);
      console.groupEnd();
      continue;
    }

    console.log('created snapshot id', data?.id);
    console.groupEnd();
    return data!;
  }
  throw new Error('Could not create a unique snapshot slug');
}

/** Verbose loader with status/count + RLS/shape hints. */
export async function loadVersionRow(versionId: string) {
  const trace = `restore:${versionId}:${Date.now()}`;
  console.group(`QSITES[versions] loadVersionRow trace=${trace}`);
  console.log('versionId', versionId);

  // Accept rows that are explicitly versions OR archived snapshots.
  const query = supabase
    .from('templates')
    .select(
      'id, slug, is_version, archived, data, header_block, footer_block, color_mode',
      { count: 'exact', head: false }
    )
    .eq('id', versionId)
    // Prefer is_version but also allow archived snapshots as fallback.
    .or('is_version.eq.true,archived.eq.true')
    .limit(1);

  console.log('executing supabase query…');
  const { data, error, status, count } = await query.maybeSingle();

  console.log('status', status, 'count', count, 'hasData', !!data, 'hasError', !!error);

  if (error) {
    console.error('supabase error', error);
    console.groupEnd();
    throw error;
  }
  if (!data) {
    console.warn('No row returned (possible RLS block or bad id).');
    console.groupEnd();
    throw new Error('Missing version');
  }

  // Validate JSON shape early to give a clearer error than a renderer crash.
  try {
    const parsed = typeof data.data === 'string' ? JSON.parse(data.data) : data.data ?? {};
    const pages = parsed?.pages ?? parsed?.data?.pages ?? [];
    if (!Array.isArray(pages)) {
      console.warn('Invalid version JSON: pages is not an array', { sample: pages });
    }
  } catch (e: any) {
    console.warn('Version JSON parse error', { message: e?.message });
  }

  console.groupEnd();
  return data;
}
