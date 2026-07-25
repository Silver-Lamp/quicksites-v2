// lib/partners/audioProvisioning/grants.ts
//
// Server-only store for owner-minted HiveJournal grant tokens (contract:
// partner-provisioning.md). The raw token is a per-owner bearer secret → encrypted at
// rest (AES-256-GCM), decrypted only server-side at call time. Deny-default RLS means
// only this service-role client can touch the table.

import { createClient } from '@supabase/supabase-js';
import { encryptGrant, decryptGrant } from './crypto';
import type { BillingMode, PartnerAudioGrant } from './types';
import { PROVISION_SCOPE } from './config';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

type Row = {
  id: string;
  user_id: string;
  template_id: string | null;
  hj_embed_id: string;
  hj_owner_id: string | null;
  scope: string;
  billing_mode: BillingMode;
  status: 'active' | 'revoked';
  grant_token_enc: string;
};

function toGrant(r: Row): PartnerAudioGrant {
  return {
    id: r.id,
    userId: r.user_id,
    templateId: r.template_id,
    hjEmbedId: r.hj_embed_id,
    hjOwnerId: r.hj_owner_id,
    scope: r.scope,
    billingMode: r.billing_mode,
    status: r.status,
  };
}

/**
 * Store (or replace) the active grant for (user, embed). Revokes any prior active grant
 * for that pair first so the partial-unique index (one active per pair) holds.
 * `token` is the raw grant shown once in the HJ dashboard — encrypted before insert.
 */
export async function storeGrant(params: {
  userId: string;
  hjEmbedId: string;
  token: string;
  templateId?: string | null;
  billingMode?: BillingMode;
}): Promise<PartnerAudioGrant> {
  const db = admin();
  const enc = encryptGrant(params.token);

  await db
    .from('partner_audio_grants')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('user_id', params.userId)
    .eq('hj_embed_id', params.hjEmbedId)
    .eq('status', 'active');

  const { data, error } = await db
    .from('partner_audio_grants')
    .insert({
      user_id: params.userId,
      hj_embed_id: params.hjEmbedId,
      template_id: params.templateId ?? null,
      grant_token_enc: enc,
      scope: PROVISION_SCOPE,
      billing_mode: params.billingMode ?? 'owner',
      status: 'active',
    })
    .select('id, user_id, template_id, hj_embed_id, hj_owner_id, scope, billing_mode, status, grant_token_enc')
    .single();

  if (error || !data) throw new Error(`storeGrant failed: ${error?.message || 'no row'}`);
  return toGrant(data as Row);
}

/** The active grant metadata for an embed (no token). Null if none. */
export async function getActiveGrant(hjEmbedId: string): Promise<PartnerAudioGrant | null> {
  const db = admin();
  const { data } = await db
    .from('partner_audio_grants')
    .select('id, user_id, template_id, hj_embed_id, hj_owner_id, scope, billing_mode, status, grant_token_enc')
    .eq('hj_embed_id', hjEmbedId)
    .eq('status', 'active')
    .maybeSingle();
  return data ? toGrant(data as Row) : null;
}

/**
 * The decrypted raw grant token for an embed — server-only, call-time use in the
 * X-Partner-Grant header. Returns null if there's no active grant. Never log or return
 * this to a client.
 */
export async function getGrantToken(hjEmbedId: string): Promise<string | null> {
  const db = admin();
  const { data } = await db
    .from('partner_audio_grants')
    .select('grant_token_enc')
    .eq('hj_embed_id', hjEmbedId)
    .eq('status', 'active')
    .maybeSingle();
  if (!data?.grant_token_enc) return null;
  try {
    return decryptGrant(data.grant_token_enc as string);
  } catch {
    return null;
  }
}

/** Mark this call as having used the grant (best-effort last_used_at bump). */
export async function touchGrant(hjEmbedId: string): Promise<void> {
  try {
    await admin()
      .from('partner_audio_grants')
      .update({ last_used_at: new Date().toISOString() })
      .eq('hj_embed_id', hjEmbedId)
      .eq('status', 'active');
  } catch {
    /* best-effort */
  }
}

export async function revokeGrant(userId: string, hjEmbedId: string): Promise<void> {
  await admin()
    .from('partner_audio_grants')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('hj_embed_id', hjEmbedId)
    .eq('status', 'active');
}

export async function listGrantsForUser(userId: string): Promise<PartnerAudioGrant[]> {
  const { data } = await admin()
    .from('partner_audio_grants')
    .select('id, user_id, template_id, hj_embed_id, hj_owner_id, scope, billing_mode, status, grant_token_enc')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  return (data as Row[] | null)?.map(toGrant) ?? [];
}

/** Resolve embed → template_id via the active grant (for usage attribution). */
export async function templateForEmbed(hjEmbedId: string): Promise<string | null> {
  const g = await getActiveGrant(hjEmbedId);
  return g?.templateId ?? null;
}
