// lib/serviceJobs/serviceJobs.ts
//
// SecondSet service-job data access (docs/SECONDSET_GLASSES_PLAN.md). Uses the service
// role — these tables are deny-default RLS and the ingest/portal routes validate opaque
// tokens themselves (glasses never hold QS creds). Keep route handlers thin; logic here.

import 'server-only';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  ServiceJob,
  ServiceJobCapture,
  ServiceJobDetail,
  ServiceJobLineItem,
  NewLineItem,
  CaptureKind,
  LineItemStatus,
} from './types';

const db = () => supabaseAdmin as any;
const token = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

/** Create a service job for a shop, minting an unguessable customer-portal token. */
export async function createServiceJob(input: {
  ownerId: string;
  title: string;
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  vehicleRef?: string | null;
}): Promise<ServiceJob | null> {
  const { data, error } = await db()
    .from('service_jobs')
    .insert({
      owner_id: input.ownerId,
      title: input.title || '',
      customer_id: input.customerId ?? null,
      customer_email: input.customerEmail ?? null,
      customer_name: input.customerName ?? null,
      vehicle_ref: input.vehicleRef ?? null,
      public_token: token(24),
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return (data as ServiceJob) ?? null;
}

/** Mint (or rotate) the per-job glasses capture token; scoped + expiring. */
export async function mintCaptureToken(
  jobId: string,
  ttlMinutes = 12 * 60,
): Promise<{ capture_token: string; expires_at: string } | null> {
  const capture_token = token(24);
  const expires_at = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  const { error } = await db()
    .from('service_jobs')
    .update({ capture_token, capture_token_expires_at: expires_at, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
  return { capture_token, expires_at };
}

/** Resolve a job from a glasses capture token, rejecting expired/unknown tokens. */
export async function getJobByCaptureToken(captureToken: string): Promise<ServiceJob | null> {
  if (!captureToken) return null;
  const { data } = await db().from('service_jobs').select('*').eq('capture_token', captureToken).maybeSingle();
  const job = data as ServiceJob | null;
  if (!job) return null;
  if (job.capture_token_expires_at && new Date(job.capture_token_expires_at).getTime() < Date.now()) return null;
  return job;
}

/** Resolve a job from its public (customer-portal) token. */
export async function getJobByPublicToken(publicToken: string): Promise<ServiceJob | null> {
  if (!publicToken) return null;
  const { data } = await db().from('service_jobs').select('*').eq('public_token', publicToken).maybeSingle();
  return (data as ServiceJob) ?? null;
}

/** Full job detail (line items + captures), ordered. */
export async function getJobDetail(jobId: string): Promise<ServiceJobDetail | null> {
  const { data: job } = await db().from('service_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return null;
  const { data: items } = await db()
    .from('service_job_line_items')
    .select('*')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true });
  const { data: caps } = await db()
    .from('service_job_captures')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  return {
    ...(job as ServiceJob),
    line_items: (items as ServiceJobLineItem[]) ?? [],
    captures: (caps as ServiceJobCapture[]) ?? [],
  };
}

/** Append a glasses capture (photo and/or spoken note) to a job. */
export async function addCapture(
  jobId: string,
  cap: {
    kind: CaptureKind;
    photoUrl?: string | null;
    mediaAssetId?: string | null;
    transcript?: string | null;
    audioUrl?: string | null;
    narrationUrl?: string | null;
    capturedBy?: string | null;
  },
): Promise<ServiceJobCapture | null> {
  const { data, error } = await db()
    .from('service_job_captures')
    .insert({
      job_id: jobId,
      kind: cap.kind,
      photo_url: cap.photoUrl ?? null,
      media_asset_id: cap.mediaAssetId ?? null,
      transcript: cap.transcript ?? null,
      audio_url: cap.audioUrl ?? null,
      narration_url: cap.narrationUrl ?? null,
      captured_by: cap.capturedBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return (data as ServiceJobCapture) ?? null;
}

/** Replace a job's proposed line items and move it to awaiting_approval. */
export async function setLineItems(jobId: string, items: NewLineItem[]): Promise<void> {
  await db().from('service_job_line_items').delete().eq('job_id', jobId);
  if (items.length) {
    const rows = items.map((it, i) => ({
      job_id: jobId,
      description: it.description || '',
      price_cents: Math.max(0, Math.round(it.price_cents || 0)),
      status: 'proposed' as LineItemStatus,
      sort_order: i,
    }));
    const { error } = await db().from('service_job_line_items').insert(rows);
    if (error) throw new Error(error.message);
  }
  await setStatus(jobId, 'awaiting_approval');
}

/** Customer decision on each line item → roll the decisions up into the job status. */
export async function applyCustomerDecision(
  jobId: string,
  decisions: { lineItemId: string; approved: boolean }[],
): Promise<ServiceJobDetail | null> {
  for (const d of decisions) {
    await db()
      .from('service_job_line_items')
      .update({ status: d.approved ? 'approved' : 'declined' })
      .eq('id', d.lineItemId)
      .eq('job_id', jobId);
  }
  const detail = await getJobDetail(jobId);
  if (!detail) return null;
  const anyApproved = detail.line_items.some((li) => li.status === 'approved');
  const anyPending = detail.line_items.some((li) => li.status === 'proposed');
  const next = anyPending ? 'awaiting_approval' : anyApproved ? 'approved' : 'declined';
  if (next !== detail.status) await setStatus(jobId, next);
  return getJobDetail(jobId);
}

export async function setStatus(jobId: string, status: ServiceJob['status']): Promise<void> {
  const { error } = await db()
    .from('service_jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** Record that the customer consented to on-site capture for this job (privacy gate). */
export async function recordConsent(jobId: string): Promise<void> {
  const { error } = await db()
    .from('service_jobs')
    .update({ consent_captured_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

/** A shop owner's jobs, newest first. */
export async function listOwnerJobs(ownerId: string, limit = 100): Promise<ServiceJob[]> {
  const { data } = await db()
    .from('service_jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as ServiceJob[]) ?? [];
}
