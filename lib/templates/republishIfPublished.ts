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
// ⚠️ THE GUARD IS THE POINT: only republish something that was ALREADY published.
// `publish_template_demo` will happily take a never-published draft live. That's correct
// for apex refreshes (apexes are meant to be public) but would be a serious side effect
// for a fleet-wide cosmetic upgrade — silently publishing drafts nobody chose to publish.
// Pass the row's own `published` value; don't infer it.

import { supabaseAdmin } from '@/lib/supabase/admin';

export type RepublishResult = {
  /** True only when a republish actually ran AND succeeded. */
  republished: boolean;
  /** Set when it was attempted and failed — callers should surface this, not swallow it. */
  warning?: string;
};

export async function republishIfPublished(
  templateId: string,
  wasPublished: boolean | null | undefined,
): Promise<RepublishResult> {
  if (!wasPublished) return { republished: false };

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
