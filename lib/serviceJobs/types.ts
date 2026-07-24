// lib/serviceJobs/types.ts — SecondSet service-job model (docs/SECONDSET_GLASSES_PLAN.md).

export type ServiceJobStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'declined'
  | 'in_progress'
  | 'done'
  | 'cancelled';

export type LineItemStatus = 'proposed' | 'approved' | 'declined';
export type CaptureKind = 'photo' | 'note';

export interface ServiceJob {
  id: string;
  owner_id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  title: string;
  vehicle_ref: string | null;
  status: ServiceJobStatus;
  public_token: string;
  capture_token: string | null;
  capture_token_expires_at: string | null;
  consent_captured_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceJobLineItem {
  id: string;
  job_id: string;
  description: string;
  price_cents: number;
  status: LineItemStatus;
  sort_order: number;
  created_at: string;
}

export interface ServiceJobCapture {
  id: string;
  job_id: string;
  kind: CaptureKind;
  photo_url: string | null;
  media_asset_id: string | null;
  transcript: string | null;
  audio_url: string | null;
  narration_url: string | null;
  captured_by: string | null;
  created_at: string;
}

export interface ServiceJobDetail extends ServiceJob {
  line_items: ServiceJobLineItem[];
  captures: ServiceJobCapture[];
}

export interface NewLineItem {
  description: string;
  price_cents: number;
}
