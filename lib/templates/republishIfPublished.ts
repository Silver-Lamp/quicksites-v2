// lib/templates/republishIfPublished.ts
//
// A public site does NOT render from `templates.data` — it renders from a published
// SNAPSHOT (see app/sites/[slug]/[[...rest]]/page.tsx: published_snapshot_id → snapshot).
// So a server-side commit through commitTemplatePatch changes the draft and nothing else:
// the live page keeps serving the old snapshot until someone republishes.
//
// That is a silent failure — the write succeeds, the DB looks right, and the site is
// unchanged. It cost a real debugging cycle on the backdrop rollout (a painted backdrop
// was committed and stored, and the live page never showed it), so it lives here as one
// named helper rather than as a line every caller has to remember.
//
// ⚠️ THE GUARD IS THE POINT: only republish something that is ALREADY LIVE.
// `publish_template_demo` will happily take a never-published draft live. That's correct
// for apex refreshes (apexes are meant to be public) but would be a serious side effect
// for a fleet-wide cosmetic upgrade — silently publishing drafts nobody chose to publish.
//
// ⚠️ AND THE GUARD ASKS `published_sites`, NOT `templates.published`.
// This used to take the row's own `published` flag. That flag is NOT what makes a page
// live: the renderer serves whatever the most recent `published_sites` row points at and
// never reads `templates.published`, `is_public` or `archived`. The flag is only set by
// /api/templates/[id]/publish — sites published by `publish_template_demo`, demo seeding
// or older flows keep `published: false` while serving perfectly well, and it defaults
// false on create/duplicate/seed.
//
// Measured on the live fleet: 11 templates were `published: false` and serving, and 7
// ARCHIVED templates still had live published_sites rows. Trusting the flag made this
// helper skip the republish for exactly those, so a cleanup that removed a fabricated
// testimonial from the draft left the fake one serving from a stale snapshot — through two
// passes, until the snapshot was checked directly.
//
// A second copy of "is this live" that drifts is worse than no copy. Ask the thing the
// renderer asks.

import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Did this template have edits that were never published, BEFORE we touched it?
 *
 * This has to be asked *before* the commit, because the commit itself moves `updated_at`
 * past the last publish and would make every site look dirty.
 *
 * Why it matters: `publish_template_demo` snapshots the CURRENT draft. Republishing a site
 * whose owner has unpublished work in progress would shove that work live as a side effect
 * of a cosmetic backdrop change — the fleet-upgrade version of that is 80 owners' drafts
 * published at once. When in doubt we skip the republish: the backdrop still lands on the
 * draft and appears the next time they publish deliberately.
 *
 * Returns `true` (i.e. assume dirty, skip republish) on any error — the safe direction.
 */
export async function hasUnpublishedDraftChanges(
  templateId: string,
  updatedAt: string | null | undefined,
): Promise<boolean> {
  if (!updatedAt) return true;
  try {
    const vers = await supabaseAdmin
      .from('template_versions')
      .select('id')
      .eq('template_id', templateId);
    const ids = (vers.data ?? []).map((v: any) => v.id);
    if (!ids.length) return true; // never snapshotted → nothing safely republishable

    const pub = await supabaseAdmin
      .from('published_sites')
      .select('published_at')
      .in('snapshot_id', ids)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const publishedAt = (pub.data as any)?.published_at;
    if (!publishedAt) return true;
    return new Date(updatedAt).getTime() > new Date(publishedAt).getTime();
  } catch {
    return true;
  }
}

export type RepublishResult = {
  /** True only when a republish actually ran AND succeeded. */
  republished: boolean;
  /** Set when it was attempted and failed — callers should surface this, not swallow it. */
  warning?: string;
};

/**
 * Is a page actually being served for this template?
 *
 * The renderer's own test: does a `published_sites` row exist pointing at one of this
 * template's versions. Errors return `false` — the safe direction is to skip a republish,
 * never to publish something on a failed lookup.
 */
export async function isLive(templateId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('published_sites')
      .select('id')
      .eq('template_id', templateId)
      .limit(1);
    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function republishIfPublished(
  templateId: string,
  /**
   * @deprecated Ignored. Liveness is derived from `published_sites` — see the note at the
   * top of this file. The parameter is kept so existing call sites stay valid; passing
   * `templates.published` is harmless but pointless, and passing nothing is preferred.
   */
  _wasPublished?: boolean | null,
): Promise<RepublishResult> {
  if (!(await isLive(templateId))) return { republished: false };

  const { error } = await (supabaseAdmin as any).rpc('publish_template_demo', {
    p_template_id: templateId,
  });

  if (error) {
    return {
      republished: false,
      warning: `Committed, but republish failed (${error.message}) — the live site is unchanged until it republishes.`,
    };
  }
  return { republished: true };
}
