// lib/commerce/webhookDedup.ts
// Idempotency guard for provider webhooks (see migration 20260627_webhook_events).
import { createClient } from '@supabase/supabase-js';

function db(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    {
      auth: { persistSession: false },
    }
  );
}

/**
 * Try to claim a webhook event for processing.
 * - returns true  → this call won the claim (first time seen); proceed to process
 * - returns false → already claimed/processed; the caller should short-circuit
 *
 * Fail-open: if the dedup write errors for any reason other than a uniqueness
 * conflict, we return true and let processing proceed — dedup is best-effort
 * hardening and must never drop a real event because the ledger hiccuped.
 */
export async function claimWebhookEvent(
  provider: string,
  eventId: string,
  eventType?: string | null
): Promise<boolean> {
  if (!eventId) return true; // nothing to dedup on; process it
  const { error } = await db()
    .from('webhook_events')
    .insert({ provider, event_id: eventId, event_type: eventType ?? null });
  if (!error) return true;
  if ((error as any).code === '23505') return false; // unique_violation → duplicate
  console.error('[webhook-dedup] claim failed (processing anyway):', error.message);
  return true;
}

/** Release a claim so the provider's retry can reprocess (call when processing fails). */
export async function releaseWebhookEvent(provider: string, eventId: string): Promise<void> {
  if (!eventId) return;
  try {
    await db().from('webhook_events').delete().eq('provider', provider).eq('event_id', eventId);
  } catch (e: any) {
    console.error('[webhook-dedup] release failed:', e?.message || e);
  }
}
