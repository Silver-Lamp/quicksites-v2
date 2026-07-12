// lib/seo/coach/run.ts
//
// Orchestrates a coaching run (daily or weekly): enumerate paid opted-in owners → for
// their most-in-need published site, gather signals → score → deterministic recs → grounded
// LLM polish (or fallback) → store a snapshot → queue ONE email per owner. Idempotent per
// UTC day (daily) / ISO week (weekly) via email_preferences.last_*_sent_on. Best-effort:
// one owner's failure never aborts the run. Kept out of the route so it's dry-run testable.

import type { SupabaseClient } from '@supabase/supabase-js';
import { captureServer, flushPostHog } from '@/lib/analytics/posthog-server';
import { listPaidCoachRecipients, type CoachRecipient } from '@/lib/seo/coach/recipients';
import { gatherSiteSeoSignals, resolveSiteDomain, type CoachSiteRow } from '@/lib/seo/coach/signals';
import { computeSeoScore } from '@/lib/seo/coach/score';
import { buildSiteSeoRecommendations } from '@/lib/seo/coach/recommendations';
import { pickDeterministicNextStep, recToStep } from '@/lib/seo/coach/flags';
import { generateDailyNextStep, generateWeeklyTopThree } from '@/lib/seo/coach/generate';
import { buildDailyCoachEmail, buildWeeklyCoachEmail, listUnsubscribeHeaders } from '@/lib/seo/coach/email';
import { mintCoachUnsubToken } from '@/lib/seo/coach/unsubToken';
import type { RecStep, SeoRec, SiteSeoSignals } from '@/lib/seo/coach/types';

type AnyClient = SupabaseClient<any, any, any>;
type Kind = 'daily' | 'weekly';

const APP_BASE_URL = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://quicksites.ai').replace(/\/+$/, '');

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Monday (UTC) of the given date's ISO week, as YYYY-MM-DD — the weekly idempotency key. */
function isoWeekStart(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (dt.getUTCDay() + 6) % 7; // 0 = Monday
  dt.setUTCDate(dt.getUTCDate() - day);
  return ymd(dt);
}

export type CoachRunResult = {
  kind: Kind;
  owners: number;
  queued: number;
  skipped: number;
  dryRun: boolean;
};

/** Per-owner: choose the site whose single most-important rec is the most urgent. */
function pickFocusSite(
  evaluated: { site: CoachSiteRow; signals: SiteSeoSignals; recs: SeoRec[]; score: number }[],
): { site: CoachSiteRow; signals: SiteSeoSignals; recs: SeoRec[]; score: number } | null {
  const withRecs = evaluated.filter((e) => e.recs.length > 0);
  if (!withRecs.length) return null;
  return withRecs.sort((a, b) => {
    const pa = a.recs[0]?.priority ?? 0;
    const pb = b.recs[0]?.priority ?? 0;
    if (pb !== pa) return pb - pa; // most urgent rec first
    return a.score - b.score; // then the lower-scoring site
  })[0];
}

async function priorWeeklyScore(admin: AnyClient, siteId: string): Promise<number | null> {
  const { data } = await (admin as any)
    .from('seo_coach_snapshots')
    .select('seo_score')
    .eq('site_id', siteId)
    .eq('kind', 'weekly')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const s = (data as any)?.seo_score;
  return typeof s === 'number' ? s : null;
}

export async function runSeoCoach(
  admin: AnyClient,
  kind: Kind,
  opts?: { limit?: number; onlyOwnerId?: string; dryRun?: boolean; now?: Date },
): Promise<CoachRunResult> {
  const now = opts?.now ?? new Date();
  const today = ymd(now);
  const weekKey = isoWeekStart(now);
  const dryRun = !!opts?.dryRun;

  let recipients: CoachRecipient[] = await listPaidCoachRecipients(admin, opts?.limit ?? 500);
  if (opts?.onlyOwnerId) recipients = recipients.filter((r) => r.ownerId === opts.onlyOwnerId);

  let queued = 0;
  let skipped = 0;

  for (const rcpt of recipients) {
    try {
      // Preference + idempotency gates.
      if (rcpt.prefs.unsubscribedAll) { skipped++; continue; }
      if (kind === 'daily') {
        if (!rcpt.prefs.daily || rcpt.prefs.lastDailySentOn === today) { skipped++; continue; }
      } else {
        if (!rcpt.prefs.weekly || rcpt.prefs.lastWeeklySentOn === weekKey) { skipped++; continue; }
      }
      // (Plan gate already applied at enumeration — listPaidCoachRecipients filters
      // user_plans to active paid plans. The /api/me/seo-coach-prefs PATCH re-checks
      // planAllows in a real request context.)

      // Evaluate each site, pick the most-in-need one.
      const evaluated = [];
      for (const site of rcpt.sites) {
        const signals = await gatherSiteSeoSignals(admin, site);
        const recs = buildSiteSeoRecommendations(signals);
        const { score } = computeSeoScore(signals);
        evaluated.push({ site, signals, recs, score });
      }
      const focus = pickFocusSite(evaluated);
      if (!focus) { skipped++; continue; } // nothing actionable → don't spam "all good"

      const siteName = String(focus.site.data?.business_name || focus.site.slug || 'your site');
      const domain = resolveSiteDomain(focus.site);
      const metaArg = { ownerId: rcpt.ownerId, templateId: focus.site.id, domain, siteName };

      const unsubUrl = `${APP_BASE_URL}/api/seo-coach/unsubscribe?token=${encodeURIComponent(mintCoachUnsubToken(rcpt.ownerId))}`;
      const manageUrl = `${APP_BASE_URL}/profile`;

      let subject: string;
      let html: string;
      let summaryForSnapshot: unknown;

      if (kind === 'daily') {
        // LLM polish; on disabled / error / over-budget it returns null → deterministic fallback.
        const llmStep = await generateDailyNextStep(metaArg, focus.recs);
        const step: RecStep = llmStep ?? recToStep(pickDeterministicNextStep(focus.recs)!);
        summaryForSnapshot = step;
        ({ subject, html } = buildDailyCoachEmail({ siteName, domain, step, score: focus.score, unsubscribeUrl: unsubUrl, manageUrl }));
      } else {
        const prior = await priorWeeklyScore(admin, focus.site.id);
        const scoreDelta = prior == null ? null : focus.score - prior;
        const llmSteps = await generateWeeklyTopThree(metaArg, focus.recs, { score: focus.score, scoreDelta });
        const summary = llmSteps ? { steps: llmSteps, model: 'gpt-4o-mini' } : null;
        summaryForSnapshot = summary;
        ({ subject, html } = buildWeeklyCoachEmail({
          siteName, domain, score: focus.score, scoreDelta, summary, recs: focus.recs, unsubscribeUrl: unsubUrl, manageUrl,
        }));
      }

      // Persist the snapshot (history / trend). Best-effort.
      if (!dryRun) {
        await (admin as any).from('seo_coach_snapshots').insert({
          site_id: focus.site.id,
          owner_id: rcpt.ownerId,
          domain,
          kind,
          seo_score: focus.score,
          gsc_connected: focus.signals.gscConnected,
          signals: focus.signals,
          recommendations: focus.recs,
          summary: summaryForSnapshot,
        });

        // Queue the email (decoupled — email-drain sends it, honoring List-Unsubscribe).
        await (admin as any).from('email_outbox').insert({
          to_email: rcpt.email,
          subject,
          html,
          headers: listUnsubscribeHeaders(unsubUrl),
          status: 'pending',
        });

        // Stamp idempotency.
        await (admin as any).from('email_preferences').upsert(
          {
            user_id: rcpt.ownerId,
            ...(kind === 'daily' ? { last_daily_sent_on: today } : { last_weekly_sent_on: weekKey }),
            updated_at: now.toISOString(),
          },
          { onConflict: 'user_id' },
        );
      }

      queued++;
      await captureServer('seo_coach_email_queued', { kind, owner_id: rcpt.ownerId, site_id: focus.site.id, score: focus.score, dry_run: dryRun }, rcpt.ownerId).catch(() => {});
    } catch {
      skipped++; // best-effort per owner
    }
  }

  await flushPostHog().catch(() => {});
  return { kind, owners: recipients.length, queued, skipped, dryRun };
}
