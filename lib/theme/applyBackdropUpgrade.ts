// lib/theme/applyBackdropUpgrade.ts
//
// The "template upgrade" side of backdrops: give an EXISTING site a backdrop so it stops
// rendering as one flat color. Safe to run in bulk over every template, because the styles
// it applies are pure CSS — **zero generation, zero cost, no external calls.**
//
// Deliberately NOT part of the SEO readiness pipeline (lib/seo/runReadinessPipeline.ts):
// a decorative backdrop isn't an SEO checklist item, and folding it in would both pollute
// the readiness score and put a batch runner in front of anything that later spends money.
// This is its own upgrade, in the shape of applyApexStandards — a version constant you
// bump to re-offer the upgrade across the fleet.
//
// Painterly (image) backdrops are NOT applied here. Generation is owner-triggered and
// per-site by design — see lib/images/paintBackdrop.ts and the standard's rule 2.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { defaultBackdropFor, readBackdrop, type SiteBackdrop } from '@/lib/theme/backdrops';

/** Bump to re-offer the upgrade on sites already carrying an `auto` backdrop. */
export const BACKDROP_STANDARDS_VERSION = 1;

export type BackdropUpgradeResult = {
  changed: boolean;
  reason?: string;
  style?: string;
};

/**
 * Apply the default backdrop for a template's industry.
 *
 * Respects the owner: a backdrop the owner picked themselves (`auto` false) is never
 * overwritten unless `force` is passed. A site that already has an auto backdrop from
 * the current standards version is left alone so bulk runs are idempotent.
 */
export async function applyBackdropUpgrade(
  templateId: string,
  actorId: string | null,
  opts: { force?: boolean; style?: SiteBackdrop['style']; intensity?: number } = {},
): Promise<BackdropUpgradeResult> {
  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, rev, industry, data')
    .eq('id', templateId)
    .maybeSingle();

  if (error || !tpl) return { changed: false, reason: 'not_found' };

  const existing = readBackdrop(tpl);

  // Hand-picked backdrops are the owner's decision — a fleet upgrade must not stomp them.
  if (existing && !existing.auto && !opts.force) {
    return { changed: false, reason: 'owner_customized', style: existing.style };
  }
  // Already carries an auto backdrop of a real style → nothing to do (idempotent).
  if (existing && existing.auto && existing.style !== 'none' && !opts.force && !opts.style) {
    return { changed: false, reason: 'already_applied', style: existing.style };
  }
  // Never silently convert a painterly site back to CSS — that would discard paid work.
  if (existing?.style === 'painterly' && existing.url && !opts.force) {
    return { changed: false, reason: 'has_painterly', style: 'painterly' };
  }

  const industryKey = (tpl as any).industry ?? (tpl as any)?.data?.meta?.industry ?? null;
  const next: SiteBackdrop = opts.style
    ? { style: opts.style, intensity: opts.intensity ?? 50, auto: !opts.style }
    : { ...defaultBackdropFor(industryKey), ...(opts.intensity != null ? { intensity: opts.intensity } : null) };

  const data = ((tpl as any).data ?? {}) as Record<string, any>;
  const patch = {
    data: {
      ...data,
      meta: {
        ...(data.meta ?? {}),
        backdrop: next,
        backdrop_standards_version: BACKDROP_STANDARDS_VERSION,
      },
    },
  };

  const err = await commitTemplatePatch(templateId, (tpl as any).rev ?? 0, patch, actorId);
  if (err) return { changed: false, reason: 'commit_failed', style: next.style };

  return { changed: true, style: next.style };
}
