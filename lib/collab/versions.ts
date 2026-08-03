// lib/collab/versions.ts
//
// An option in a client collab is a LINEAGE of templates, not one template.
//
// ⚠️ WHY NOT EDIT IN PLACE. Applying a reviewer's suggestion by editing the live variant rewrites
// the page the client already looked at. She comes back to something that changed under her, with
// no way to see what it used to be and no way to say "actually, the old headline was better". A
// version is a new template row; the previous one stays published and openable.
//
// ⚠️ WHY THE OPTION KEY IS STORED, NOT DERIVED FROM POSITION. The client has been told "option B".
// If B's v2 were appended to an array, B would become D — after a conversation in which she called
// it B. The letter is an identifier the moment it is spoken aloud.
//
// ⚠️ ZERO ROWS IS A VALID STATE, NOT AN UNMIGRATED ONE. The live collab predates this table, so
// `resolveOptions` falls back to `client_collabs.template_ids` as v1 of A, B, C… A model that
// needs a backfill before it works is a model that breaks the only thing already in production.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Collab } from './collabs';

export type OptionVersion = {
  version: number;
  templateId: string;
  note: string | null;
  createdAt: string | null;
};

export type CollabOption = {
  key: string;                 // 'A' | 'B' | 'C' …
  versions: OptionVersion[];   // ascending; [0] is v1
  latest: OptionVersion;
};

function db(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function optionKeyForIndex(i: number): string {
  return String.fromCharCode(65 + i);
}

/**
 * The options on the table, each with its version history.
 *
 * Falls back to `collab.template_ids` when no version rows exist — see the header. The fallback
 * is not a degraded mode: one version per option is the normal state until feedback is applied.
 */
export async function resolveOptions(collab: Collab): Promise<CollabOption[]> {
  const fallback = (): CollabOption[] =>
    (collab.template_ids ?? []).map((templateId, i) => {
      const v: OptionVersion = { version: 1, templateId, note: null, createdAt: null };
      return { key: optionKeyForIndex(i), versions: [v], latest: v };
    });

  const s = db();
  if (!s) return fallback();

  const { data, error } = await s
    .from('collab_option_versions')
    .select('option_key, version, template_id, note, created_at')
    .eq('collab_id', collab.id)
    .order('version', { ascending: true });

  // ⚠️ An error is NOT an empty history. Treating a failed query as "no versions" would quietly
  // show the client v1 of everything and hide the revisions built for her — the worst possible
  // failure mode here, because it looks exactly like the correct output.
  if (error) throw new Error(`resolveOptions: ${error.message}`);
  if (!data?.length) return fallback();

  const byKey = new Map<string, OptionVersion[]>();
  for (const row of data as any[]) {
    const list = byKey.get(row.option_key) ?? [];
    list.push({
      version: row.version,
      templateId: row.template_id,
      note: row.note ?? null,
      createdAt: row.created_at ?? null,
    });
    byKey.set(row.option_key, list);
  }

  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, versions]) => ({ key, versions, latest: versions[versions.length - 1] }));
}

/**
 * Record a new version of an option.
 *
 * The caller supplies the already-built template. This function does not duplicate or publish —
 * building a variant is a deliberate act with its own verification (docs/CUSTOM_SITES.md §7), and
 * a helper that silently created and published sites would make skipping that checklist the
 * default path.
 */
export async function addOptionVersion(
  collabId: string,
  optionKey: string,
  templateId: string,
  note?: string | null,
): Promise<OptionVersion | null> {
  const s = db();
  if (!s) return null;

  const { data: existing } = await s
    .from('collab_option_versions')
    .select('version')
    .eq('collab_id', collabId)
    .eq('option_key', optionKey)
    .order('version', { ascending: false })
    .limit(1);

  const next = ((existing?.[0] as any)?.version ?? 0) + 1;

  const { data, error } = await s
    .from('collab_option_versions')
    .insert({
      collab_id: collabId,
      option_key: optionKey,
      version: next,
      template_id: templateId,
      note: note ?? null,
    } as any)
    .select('version, template_id, note, created_at')
    .single();

  if (error) return null;
  return {
    version: (data as any).version,
    templateId: (data as any).template_id,
    note: (data as any).note ?? null,
    createdAt: (data as any).created_at ?? null,
  };
}

/**
 * Seed version rows from the collab's current `template_ids`, so a collab that has been running on
 * the fallback gets an explicit history before its first v2 is added.
 *
 * ⚠️ Idempotent and non-destructive: it does nothing at all if any version row already exists.
 * Re-seeding a collab that has revisions would renumber a lineage the client has been reading.
 */
export async function seedVersionsFromTemplateIds(collab: Collab): Promise<number> {
  const s = db();
  if (!s || !collab.template_ids?.length) return 0;

  const { data: any_ } = await s
    .from('collab_option_versions')
    .select('id')
    .eq('collab_id', collab.id)
    .limit(1);
  if (any_?.length) return 0;

  const rows = collab.template_ids.map((templateId, i) => ({
    collab_id: collab.id,
    option_key: optionKeyForIndex(i),
    version: 1,
    template_id: templateId,
    note: null,
  }));

  const { error } = await s.from('collab_option_versions').insert(rows as any);
  return error ? 0 : rows.length;
}
