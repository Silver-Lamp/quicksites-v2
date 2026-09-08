// lib/tradeSites/activate.ts
//
// What happens the moment a business claims the site we built for it.
//
// ⚠️ BEFORE THIS EXISTED, CLAIMING MADE THE SITE DISAPPEAR. The public route only renders an
// unclaimed draft (`isPublicPreClaimDraft`: no owner + listing_import/operator_draft). The claim
// RPC sets owner_id and claim_source='claimed', so the same URL that showed the watermarked
// preview five minutes earlier returned 404 to everyone but the new owner — while the welcome page
// said "Your site is live". Publishing on claim makes that sentence true: the site goes live on
// its subdomain, clean and indexable, the instant it becomes theirs.
//
// Also records the claim on the prospect row ('claimed' was declared and never written), which
// is the numerator of the claim rate — the one number the whole vertical depends on.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicSiteUrl } from '@/lib/sites/publicUrl';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { isTradeIndustry } from './config';

export type ActivateResult = {
  published: boolean;
  url: string | null;
  industry: string | null;
  isTrade: boolean;
  error?: string;
};

export async function activateClaimedSite(templateId: string, userId: string): Promise<ActivateResult> {
  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, custom_domain, industry, owner_id, claim_source, published')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !tpl) return { published: false, url: null, industry: null, isTrade: false, error: error?.message || 'not_found' };

  const t = tpl as any;
  const industry: string | null = t.industry ?? null;
  const isTrade = isTradeIndustry(industry);
  const url = publicSiteUrl({ custom_domain: t.custom_domain, slug: t.slug });

  // Defensive: only the new owner's claim publishes. The RPC already enforced this, but this
  // function is exported and a future caller might not have.
  if (t.owner_id !== userId) return { published: !!t.published, url, industry, isTrade, error: 'not_owner' };

  let published = !!t.published;
  const { error: pubErr } = await supabaseAdmin.rpc('publish_template', {
    p_template_id: templateId,
    p_version_id: null,
    p_actor: userId,
  } as any);
  if (pubErr) {
    console.error('[trade-sites] publish on claim failed:', pubErr.message);
  } else {
    published = true;
  }

  // The prospect row is the funnel's memory. Best-effort: a missing row (site built by hand) is
  // not an error.
  try {
    await (supabaseAdmin as any)
      .from('outreach_prospects')
      .update({ status: 'claimed', claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('template_id', templateId)
      .neq('status', 'claimed');
  } catch (e) {
    console.warn('[trade-sites] prospect claim mark failed:', (e as any)?.message || e);
  }

  await captureServer(
    EVENTS.TRADE_SITE_CLAIMED,
    { template_id: templateId, industry, is_trade: isTrade, published, url },
    userId,
  );

  return { published, url, industry, isTrade };
}
