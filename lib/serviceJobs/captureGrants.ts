// lib/serviceJobs/captureGrants.ts
//
// Per-shop HJ capture-grant tokens. A shop owner grants QS read of their `secondset_field`
// captures on HJ's side (POST /api/captures/grants) and hands us the token; we store it
// keyed by owner and send it as `X-Partner-Grant` when pulling. Service-role (deny-default
// RLS). See crosstalk/contracts/glasses-capture.md.

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

const db = () => supabaseAdmin as any;

export async function getCaptureGrant(ownerId: string): Promise<string | null> {
  const { data } = await db().from('secondset_capture_grants').select('grant_token').eq('owner_id', ownerId).maybeSingle();
  return (data?.grant_token as string) ?? null;
}

export async function setCaptureGrant(ownerId: string, grantToken: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from('secondset_capture_grants')
    .upsert({ owner_id: ownerId, grant_token: grantToken, updated_at: now, created_at: now }, { onConflict: 'owner_id' });
  if (error) throw new Error(error.message);
}

/** Owners who have granted read — for the sync cron to iterate. */
export async function ownersWithCaptureGrant(): Promise<string[]> {
  const { data } = await db().from('secondset_capture_grants').select('owner_id');
  return (data ?? []).map((r: any) => r.owner_id);
}
