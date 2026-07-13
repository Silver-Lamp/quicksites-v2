// lib/gsc/connectDomain.ts
//
// Programmatic GSC connect for a freshly-bought geo-domain: verify it as a Search Console
// *domain property* (DNS TXT via Vercel — the domain's nameservers are ours) and add it, so
// the rank cron / summary can measure it from day one. Uses the OPERATOR's OAuth token
// (needs the webmasters read-write + siteverification scopes — see /api/gsc/auth-url), so
// the operator must re-consent GSC once after the scope upgrade.
//
// Best-effort by design: DNS propagation is asynchronous, so first-attempt verification
// often lands as `pending` (TXT published, verify later) — retry via verifyPendingGscDomain
// (POST /api/admin/prospects/gsc-connect) once DNS propagates.

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { gscClientId, gscClientSecret } from '@/lib/gsc/oauthConfig';
import { addDnsTxtRecord } from '@/lib/domains/vercel';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

export function gscAutoConnectConfigured(): boolean {
  return !!(gscClientId() && gscClientSecret());
}

export function gscAutoConnectEnabled(): boolean {
  const f = process.env.GSC_AUTO_CONNECT_ENABLED;
  return (f === '1' || f === 'true') && gscAutoConnectConfigured();
}

/** Bare, comparable domain (no scheme / www / sc-domain: / trailing slash). */
export function bareDomain(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .replace(/[.:]+$/, '');
}

/** Search Console *domain property* id for a bare domain. */
export function scDomainSiteUrl(domain: string): string {
  return `sc-domain:${bareDomain(domain)}`;
}

export type GscConnectResult = {
  ok: boolean;
  verified: boolean;
  pending: boolean;
  siteUrl: string;
  reason?: string;
};

/** Build an OAuth client from any of the operator's stored GSC tokens (same Google account). */
async function operatorOAuthClient(userId: string) {
  const { data } = await admin()
    .from('gsc_tokens')
    .select('access_token, refresh_token, expiry')
    .eq('user_id', userId)
    .not('refresh_token', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!data?.refresh_token) return null;
  const client = new google.auth.OAuth2(gscClientId(), gscClientSecret());
  client.setCredentials({
    refresh_token: data.refresh_token,
    access_token: data.access_token ?? undefined,
    expiry_date: data.expiry ? new Date(data.expiry).getTime() : undefined,
  });
  return client;
}

/** Persist a token row for the new property so the summary/rank readers can query it. */
async function persistPropertyToken(siteUrl: string, userId: string, client: any) {
  const creds = client?.credentials ?? {};
  await admin()
    .from('gsc_tokens')
    .upsert(
      {
        domain: siteUrl, // property string (sc-domain:…) — matches the oauth-callback convention
        access_token: creds.access_token ?? null,
        refresh_token: creds.refresh_token ?? null,
        expiry: creds.expiry_date ? new Date(creds.expiry_date).toISOString() : null,
        user_id: userId,
      },
      { onConflict: 'domain' },
    );
}

/**
 * Verify (DNS TXT) + add the domain as a Search Console property using the operator's token.
 * Publishes the TXT via Vercel DNS. Returns `pending` when verification hasn't propagated yet.
 */
export async function connectDomainToGsc(domain: string, userId: string): Promise<GscConnectResult> {
  const siteUrl = scDomainSiteUrl(domain);
  const bare = bareDomain(domain);
  const base: GscConnectResult = { ok: false, verified: false, pending: false, siteUrl };

  if (!gscAutoConnectConfigured()) return { ...base, reason: 'not_configured' };
  const auth = await operatorOAuthClient(userId);
  if (!auth) return { ...base, reason: 'no_gsc_token' }; // operator must connect GSC (write scope) once

  const sv = google.siteVerification({ version: 'v1', auth });
  const wm = google.webmasters({ version: 'v3', auth });

  // 1) Ask Google for the DNS TXT token for this domain.
  let token = '';
  try {
    const r = await sv.webResource.getToken({
      requestBody: { verificationMethod: 'DNS_TXT', site: { type: 'INET_DOMAIN', identifier: bare } },
    });
    token = r.data.token || '';
  } catch (e: any) {
    return { ...base, reason: `gettoken_failed: ${e?.message || e}` };
  }
  if (!token) return { ...base, reason: 'no_verification_token' };

  // 2) Publish it via Vercel DNS (our nameservers).
  try {
    await addDnsTxtRecord(bare, token);
  } catch (e: any) {
    return { ...base, reason: `dns_write_failed: ${e?.message || e}` };
  }

  // 3) Verify. DNS may not have propagated yet → pending (retry later); TXT is already live.
  try {
    await sv.webResource.insert({
      verificationMethod: 'DNS_TXT',
      requestBody: { site: { type: 'INET_DOMAIN', identifier: bare } },
    });
  } catch (e: any) {
    return { ...base, ok: true, pending: true, reason: `verify_pending: ${e?.message || e}` };
  }

  // 4) Add the property + persist a token row so the readers can query rank.
  try {
    await wm.sites.add({ siteUrl });
  } catch (e: any) {
    return { ...base, ok: true, verified: true, pending: true, reason: `sites_add_failed: ${e?.message || e}` };
  }
  await persistPropertyToken(siteUrl, userId, auth);
  return { ok: true, verified: true, pending: false, siteUrl };
}

/**
 * Retry verification for a domain whose TXT is already published (DNS has since propagated).
 * Idempotent — re-verifies, adds the property if missing, persists the token.
 */
export async function verifyPendingGscDomain(domain: string, userId: string): Promise<GscConnectResult> {
  const siteUrl = scDomainSiteUrl(domain);
  const bare = bareDomain(domain);
  const base: GscConnectResult = { ok: false, verified: false, pending: false, siteUrl };

  if (!gscAutoConnectConfigured()) return { ...base, reason: 'not_configured' };
  const auth = await operatorOAuthClient(userId);
  if (!auth) return { ...base, reason: 'no_gsc_token' };

  const sv = google.siteVerification({ version: 'v1', auth });
  const wm = google.webmasters({ version: 'v3', auth });

  try {
    await sv.webResource.insert({
      verificationMethod: 'DNS_TXT',
      requestBody: { site: { type: 'INET_DOMAIN', identifier: bare } },
    });
  } catch (e: any) {
    return { ...base, pending: true, reason: `verify_pending: ${e?.message || e}` };
  }
  try {
    await wm.sites.add({ siteUrl });
  } catch (e: any) {
    return { ...base, verified: true, pending: true, reason: `sites_add_failed: ${e?.message || e}` };
  }
  await persistPropertyToken(siteUrl, userId, auth);
  return { ok: true, verified: true, pending: false, siteUrl };
}
