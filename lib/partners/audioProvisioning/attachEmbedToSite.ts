// lib/partners/audioProvisioning/attachEmbedToSite.ts
//
// The last mile of audio provisioning: put the connected embed ON the site. Without this,
// "no hand-pasting" is only half true — the owner connects a grant here but still has to
// copy the embed id into the `about_that` block by hand in the editor (the very step the
// contract exists to remove).
//
// Split the usual way: a PURE function that patches a template `data` blob (unit-testable,
// no I/O) + a thin server action that loads the template, calls it, and commits through the
// sanctioned RPC (direct UPDATEs to `templates` are trigger-blocked — CLAUDE.md §8).

import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

type AnyBlock = { type?: string; content?: any; blocks?: AnyBlock[]; content_blocks?: AnyBlock[] };

/** The block array a page renders from — canonical `content_blocks`, legacy `blocks` fallback. */
function pageBlocks(p: any): AnyBlock[] {
  return Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
}

/** Every block across every page, flattened (incl. one level of nesting). */
function allBlocks(data: any): AnyBlock[] {
  const out: AnyBlock[] = [];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    for (const b of pageBlocks(p)) {
      out.push(b);
      const nested = Array.isArray(b?.content_blocks) ? b.content_blocks : Array.isArray(b?.blocks) ? b.blocks : [];
      if (nested.length) out.push(...nested);
    }
  }
  return out;
}

export type SetEmbedAction = 'noop' | 'updated' | 'inserted';
export type SetEmbedResult = { data: any; changed: boolean; action: SetEmbedAction };

/**
 * Point the site's `about_that` player at `embedId`.
 *
 * - An existing block already on this embed → no-op (idempotent; safe to call on every
 *   connect, and safe for the pipeline to re-run).
 * - An existing block on a different/blank embed → updated in place, so re-connecting a new
 *   HJ voice re-points the player instead of stacking a second one.
 * - No block at all → appended to the first page, but ONLY with `insertIfMissing`. Adding a
 *   block changes what visitors see, so that stays an explicit caller decision rather than
 *   a side effect of storing a token.
 */
export function setAboutThatEmbed(
  data: any,
  embedId: string,
  opts: { insertIfMissing?: boolean } = {},
): SetEmbedResult {
  const id = String(embedId ?? '').trim();
  if (!id) return { data, changed: false, action: 'noop' };

  const existing = allBlocks(data).find((b) => b?.type === 'about_that');
  if (existing && String(existing.content?.embed_id ?? '').trim() === id) {
    return { data, changed: false, action: 'noop' };
  }
  if (!existing && !opts.insertIfMissing) return { data, changed: false, action: 'noop' };

  // Clone so callers/tests keep the input intact.
  const next = typeof structuredClone === 'function' ? structuredClone(data ?? {}) : JSON.parse(JSON.stringify(data ?? {}));

  const target = allBlocks(next).find((b) => b?.type === 'about_that');
  if (target) {
    target.content = { ...(target.content ?? {}), embed_id: id };
    return { data: next, changed: true, action: 'updated' };
  }

  if (!Array.isArray(next.pages) || !next.pages.length) next.pages = [{}];
  const page = next.pages[0];
  const arr = pageBlocks(page);
  const block: any = createDefaultBlock('about_that');
  block.content = { ...(block.content ?? {}), embed_id: id };
  arr.push(block);
  // Write both fields so the canonical + legacy readers + the live editor all agree.
  page.content_blocks = arr;
  page.blocks = arr;
  return { data: next, changed: true, action: 'inserted' };
}

export type AttachResult = {
  ok: boolean;
  changed: boolean;
  action?: SetEmbedAction;
  reason?: 'no_template' | 'commit_failed';
  error?: string;
};

/**
 * Load → patch → commit. Caller MUST have already authorized the actor against this
 * template (the routes use requireTemplateOwner) — this function trusts its inputs.
 */
export async function attachEmbedToSite(params: {
  templateId: string;
  hjEmbedId: string;
  actorId: string | null;
  insertIfMissing?: boolean;
}): Promise<AttachResult> {
  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, data, rev')
    .eq('id', params.templateId)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const tpl: any = t;
  const res = setAboutThatEmbed(tpl.data ?? {}, params.hjEmbedId, { insertIfMissing: params.insertIfMissing });
  if (!res.changed) return { ok: true, changed: false, action: res.action };

  const commitErr = await commitTemplatePatch(params.templateId, tpl.rev ?? 0, { data: res.data }, params.actorId);
  if (commitErr) return { ok: false, changed: false, reason: 'commit_failed', error: commitErr };

  return { ok: true, changed: true, action: res.action };
}
