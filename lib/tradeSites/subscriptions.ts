// lib/tradeSites/subscriptions.ts
//
// The custom-domain subscription for a claimed trade site: recorded at checkout, confirmed by
// the Stripe webhook, and — when the registrar flag is on — provisioned without a human.
//
// Provisioning is the part that used to need a person. It is written so every failure leaves a
// row that says WHY (`domain_status` + `domain_detail`) and an admin task, never a paid customer
// with nothing happening: a subscription that bills for a domain nobody registered is the
// worst outcome available here, and it is silent unless something writes it down.
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { purchaseDomain } from '@/lib/domains/registrar';
import { captureServer } from '@/lib/analytics/posthog-server';
import { EVENTS } from '@/lib/analytics/events';
import { tradeSiteRefFromMetadata, normalizeApexDomain } from './config';

const db = () => supabaseAdmin as any;

export type TradeSiteSubscription = {
  id: string;
  template_id: string;
  owner_id: string | null;
  tier: string;
  desired_domain: string | null;
  domain_status: 'pending' | 'purchased' | 'bound' | 'manual' | 'failed';
  domain_detail: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  renter_email: string | null;
  payment_count: number;
  last_paid_at: string | null;
  last_payment_cents: number | null;
};

export async function getTradeSiteSubscription(templateId: string): Promise<TradeSiteSubscription | null> {
  const { data } = await db().from('trade_site_subscriptions').select('*').eq('template_id', templateId).maybeSingle();
  return (data as TradeSiteSubscription) ?? null;
}

async function getBySubscriptionId(subId: string): Promise<TradeSiteSubscription | null> {
  const { data } = await db().from('trade_site_subscriptions').select('*').eq('stripe_subscription_id', subId).maybeSingle();
  return (data as TradeSiteSubscription) ?? null;
}

async function patch(templateId: string, fields: Record<string, unknown>) {
  const { error } = await db()
    .from('trade_site_subscriptions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('template_id', templateId);
  if (error) throw new Error(`trade_site_subscriptions update: ${error.message}`);
}

/** Called by the checkout route. One row per template; a second checkout updates the first. */
export async function recordCheckoutCreated(input: { templateId: string; ownerId: string; domain: string }) {
  const { error } = await db()
    .from('trade_site_subscriptions')
    .upsert(
      {
        template_id: input.templateId,
        owner_id: input.ownerId,
        desired_domain: input.domain,
        subscription_status: 'checkout_created',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'template_id' },
    );
  if (error) throw new Error(`trade_site_subscriptions upsert: ${error.message}`);
  await captureServer(EVENTS.TRADE_SITE_CHECKOUT_CREATED, { template_id: input.templateId, domain: input.domain }, input.ownerId);
}

/** checkout.session.completed → the subscription exists. Then try to provision the domain. */
export async function applyCheckoutCompleted(s: Stripe.Checkout.Session): Promise<boolean> {
  const ref = tradeSiteRefFromMetadata(s.metadata as any);
  if (!ref) return false;
  await patch(ref.templateId, {
    stripe_customer_id: (typeof s.customer === 'string' ? s.customer : s.customer?.id) || null,
    stripe_subscription_id: (typeof s.subscription === 'string' ? s.subscription : s.subscription?.id) || null,
    subscription_status: 'active',
    renter_email: s.customer_details?.email || null,
    ...(ref.domain ? { desired_domain: ref.domain } : {}),
  });
  // Best-effort and separately retryable: a provisioning failure must never make Stripe retry a
  // checkout we have already recorded.
  try {
    await provisionDomain(ref.templateId);
  } catch (e) {
    console.error('[trade-sites] provision after checkout failed:', (e as any)?.message || e);
  }
  return true;
}

/** customer.subscription.updated / deleted */
export async function applySubscriptionStatus(sub: Stripe.Subscription, deleted: boolean): Promise<boolean> {
  const ref = tradeSiteRefFromMetadata(sub.metadata as any);
  if (!ref) return false;
  await patch(ref.templateId, { subscription_status: deleted ? 'canceled' : sub.status, stripe_subscription_id: sub.id });
  return true;
}

/** invoice.paid — the only event that proves money moved. Returns false when the invoice is not ours. */
export async function applyInvoicePaid(input: { subscriptionId: string; invoiceId: string; amountCents: number | null; paidAt: string }): Promise<boolean> {
  const row = await getBySubscriptionId(input.subscriptionId);
  if (!row) return false;
  await patch(row.template_id, {
    payment_count: (row.payment_count ?? 0) + 1,
    last_paid_at: input.paidAt,
    last_payment_cents: input.amountCents,
    subscription_status: 'active',
  });
  await captureServer(
    EVENTS.TRADE_SITE_PAID,
    { template_id: row.template_id, invoice_id: input.invoiceId, amount_cents: input.amountCents, payment_number: (row.payment_count ?? 0) + 1 },
    row.owner_id,
  );
  return true;
}

function registerEnabled(): boolean {
  const v = process.env.VERCEL_DOMAIN_REGISTER_ENABLED;
  return (v === '1' || v === 'true') && !!process.env.VERCEL_TOKEN;
}

async function adminTask(title: string, details: string) {
  try {
    await db().from('admin_tasks').insert({ title, details, priority: 'high', category: 'trade-sites', source: 'lib/tradeSites/subscriptions.ts' });
  } catch (e) {
    console.warn('[trade-sites] admin task insert failed:', (e as any)?.message || e);
  }
}

/** Columns `snapshots` shares with `templates`; a custom domain is served from a snapshot row. */
const SNAPSHOT_COLUMNS = [
  'editor_email', 'template_name', 'data', 'brand', 'theme', 'branding_profile_id', 'color_scheme', 'template_id',
  'thumbnail_url', 'owner_id', 'template_slug', 'industry', 'layout', 'is_site', 'meta', 'color_mode', 'header_block',
  'footer_block', 'services_jsonb', 'contact_email', 'business_name', 'address_line1', 'address_line2', 'city', 'state',
  'postal_code', 'latitude', 'longitude', 'phone', 'domain', 'custom_domain', 'logo_url', 'hero_url', 'banner_url',
];

/**
 * Bind a domain to the template so the custom host serves it.
 *
 * ⚠️ A custom host is resolved through the LEGACY `sites` table (`app/host/[[...rest]]`:
 * findSiteByHost reads sites.domain), and is served from sites.published_snapshot_id — a column
 * no publish path writes (CLAUDE.md §8, GEO_RENTAL_RUNBOOK). So binding is three writes, and a
 * missing third one means the domain serves the live DRAFT rather than what the owner published.
 */
async function bindDomain(templateId: string, apex: string): Promise<void> {
  // 1) templates.custom_domain via the sanctioned RPC (direct UPDATEs are guard-blocked).
  const { error: rpcErr } = await db().rpc('set_template_custom_domain', { p_template_id: templateId, p_domain: apex });
  if (rpcErr) throw new Error(`set_template_custom_domain: ${rpcErr.message}`);

  // 2) Re-publish so published_sites.domain follows the new address.
  const { error: pubErr } = await db().rpc('publish_template', { p_template_id: templateId, p_version_id: null, p_actor: null });
  if (pubErr) throw new Error(`publish_template: ${pubErr.message}`);

  // 3) The legacy sites row + a snapshot minted from the template's current row.
  const { data: tpl, error: tplErr } = await db().from('templates').select('*').eq('id', templateId).maybeSingle();
  if (tplErr || !tpl) throw new Error(`template read: ${tplErr?.message || 'not found'}`);

  const { data: top } = await db().from('snapshots').select('rev').eq('template_id', templateId).order('rev', { ascending: false }).limit(1).maybeSingle();
  const snapshot: Record<string, unknown> = {};
  for (const k of SNAPSHOT_COLUMNS) if (k in tpl) snapshot[k] = tpl[k];
  snapshot.template_id = templateId;
  snapshot.template_slug = tpl.slug;
  snapshot.custom_domain = apex;
  snapshot.rev = Math.max(Number(tpl.rev ?? 0), Number(top?.rev ?? 0)) + 1;
  snapshot.commit_message = 'trade-site custom domain bound';
  snapshot.created_at = new Date().toISOString();
  snapshot.published = true;
  const { data: snap, error: snapErr } = await db().from('snapshots').insert(snapshot).select('id').single();
  if (snapErr) throw new Error(`snapshot mint: ${snapErr.message}`);

  const { data: existing } = await db().from('sites').select('id').or(`template_id.eq.${templateId},domain.eq.${apex}`).limit(1).maybeSingle();
  const siteRow = {
    slug: tpl.slug,
    domain: apex,
    template_id: templateId,
    business_name: tpl.business_name ?? tpl.template_name ?? null,
    owner_id: tpl.owner_id ?? null,
    is_published: true,
    published_snapshot_id: snap.id,
    published_rev: snapshot.rev,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error: siteErr } = existing?.id
    ? await db().from('sites').update(siteRow).eq('id', existing.id)
    : await db().from('sites').insert(siteRow);
  if (siteErr) throw new Error(`sites row: ${siteErr.message}`);
}

/**
 * Register + attach + bind the domain the owner paid for. Idempotent: safe to call again after a
 * failure (the row records where it got to). Never throws to the webhook; every outcome is a row.
 */
export async function provisionDomain(templateId: string): Promise<TradeSiteSubscription | null> {
  const row = await getTradeSiteSubscription(templateId);
  if (!row) return null;
  if (row.domain_status === 'bound') return row;
  const apex = normalizeApexDomain(row.desired_domain || '');
  if (!apex) {
    await patch(templateId, { domain_status: 'failed', domain_detail: 'no valid domain on the subscription' });
    await adminTask(`Trade site ${templateId}: paid, but no valid domain recorded`, `desired_domain=${row.desired_domain ?? '(none)'}`);
    return getTradeSiteSubscription(templateId);
  }

  if (!registerEnabled()) {
    await patch(templateId, { domain_status: 'manual', domain_detail: 'VERCEL_DOMAIN_REGISTER_ENABLED is off — register and bind by hand' });
    await adminTask(`Register ${apex} for a paying trade site`, `Template ${templateId}. Set VERCEL_DOMAIN_REGISTER_ENABLED=1 and re-run provisionDomain, or buy + bind by hand.`);
    return getTradeSiteSubscription(templateId);
  }

  if (row.domain_status !== 'purchased') {
    const bought = await purchaseDomain(apex, { attach: true, renew: true });
    if (!bought.ok) {
      await patch(templateId, { domain_status: 'failed', domain_detail: bought.reason || 'purchase failed' });
      await adminTask(`Domain purchase failed: ${apex}`, `Template ${templateId}: ${bought.reason || 'unknown'}. The subscription is billing; fix and re-run provisionDomain.`);
      return getTradeSiteSubscription(templateId);
    }
    await patch(templateId, { domain_status: 'purchased', domain_detail: `purchased at $${bought.priceUsd ?? '?'}/yr${bought.attached ? ', attached' : ', ATTACH FAILED'}` });
  }

  try {
    await bindDomain(templateId, apex);
    await patch(templateId, { domain_status: 'bound', domain_detail: null });
  } catch (e) {
    const msg = (e as any)?.message || String(e);
    await patch(templateId, { domain_status: 'failed', domain_detail: `bind: ${msg}` });
    await adminTask(`Domain bought but not bound: ${apex}`, `Template ${templateId}: ${msg}`);
  }
  return getTradeSiteSubscription(templateId);
}
