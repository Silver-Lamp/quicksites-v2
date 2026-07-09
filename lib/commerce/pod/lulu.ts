// lib/commerce/pod/lulu.ts
//
// Lulu Print API client (print-on-demand: books/paperbacks). Ported from
// hivejournal (apps/backend/src/services/lulu.ts) — framework-agnostic
// (fetch + process.env + crypto). OAuth2 client-credentials w/ in-memory token.
//
// Env: LULU_CLIENT_KEY, LULU_CLIENT_SECRET, LULU_API_BASE (default sandbox),
//      LULU_CONTACT_EMAIL, LULU_WEBHOOK_SECRET. isLuluConfigured() gates callers.

import crypto from 'crypto';

const DEFAULT_API_BASE = 'https://api.sandbox.lulu.com';

export function luluApiBase(): string {
  return (process.env.LULU_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '');
}
export function isLuluConfigured(): boolean {
  return Boolean(process.env.LULU_CLIENT_KEY && process.env.LULU_CLIENT_SECRET);
}
export function isLuluSandbox(): boolean {
  return luluApiBase().includes('sandbox');
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!isLuluConfigured()) throw new Error('Lulu is not configured (set LULU_CLIENT_KEY + LULU_CLIENT_SECRET).');
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.accessToken;

  const basic = Buffer.from(`${process.env.LULU_CLIENT_KEY}:${process.env.LULU_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${luluApiBase()}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Lulu auth failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
  return cachedToken.accessToken;
}

async function luluFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${luluApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const detail = body?.detail || body?.errors || body?.raw || JSON.stringify(body);
    throw new Error(`Lulu ${init.method || 'GET'} ${path} failed (${res.status}): ${String(detail).slice(0, 400)}`);
  }
  return body as T;
}

/** 6×9 B/W perfect-bound paperback, 60# white. VERIFY against Lulu's cover tool before prod. */
export const POD_PACKAGE_6X9_BW_PB = '0600X0900BWSTDPB060UW444MXX';
const PPI_60_WHITE = 444;

export function spineWidthInches(pageCount: number): number {
  const raw = Math.max(0, pageCount) / PPI_60_WHITE;
  return Math.max(0.06, Number(raw.toFixed(4)));
}

export type ShippingLevel = 'MAIL' | 'PRIORITY_MAIL' | 'GROUND' | 'EXPEDITED' | 'EXPRESS';

export interface ShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  postcode: string;
  country_code: string; // ISO-2
  phone_number: string;
  email?: string;
}

export interface CostLineItem {
  pageCount: number;
  quantity: number;
  podPackageId?: string;
}
export interface LuluCost {
  currency: string;
  line_item_costs: number;
  shipping_cost: number;
  total_tax: number;
  total_cost_excl_tax: number;
  total_cost_incl_tax: number;
  raw: any;
}

export async function calculatePrintCost(opts: {
  lineItems: CostLineItem[];
  shippingAddress: ShippingAddress;
  shippingLevel: ShippingLevel;
}): Promise<LuluCost> {
  const body = {
    line_items: opts.lineItems.map((li) => ({
      page_count: li.pageCount,
      pod_package_id: li.podPackageId || POD_PACKAGE_6X9_BW_PB,
      quantity: li.quantity,
    })),
    shipping_address: opts.shippingAddress,
    shipping_option: opts.shippingLevel,
  };
  const r = await luluFetch<any>('/print-job-cost-calculations/', { method: 'POST', body: JSON.stringify(body) });
  const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
  return {
    currency: r.currency || 'USD',
    line_item_costs: num(r.line_item_costs?.total_cost_incl_tax ?? r.line_item_costs),
    shipping_cost: num(r.shipping_cost?.total_cost_incl_tax ?? r.shipping_cost),
    total_tax: num(r.total_tax),
    total_cost_excl_tax: num(r.total_cost_excl_tax),
    total_cost_incl_tax: num(r.total_cost_incl_tax),
    raw: r,
  };
}

export interface CreatePrintJobInput {
  title: string;
  interiorUrl: string;
  coverUrl: string;
  pageCount: number;
  quantity: number;
  podPackageId?: string;
  shippingAddress: ShippingAddress;
  shippingLevel: ShippingLevel;
  contactEmail?: string;
  externalId?: string;
}
export interface LuluPrintJob {
  id: number;
  status: string;
  raw: any;
}

export async function createPrintJob(input: CreatePrintJobInput): Promise<LuluPrintJob> {
  const body = {
    contact_email: input.contactEmail || process.env.LULU_CONTACT_EMAIL || input.shippingAddress.email,
    external_id: input.externalId,
    line_items: [
      {
        external_id: input.externalId,
        title: input.title,
        quantity: input.quantity,
        printable_normalization: {
          pod_package_id: input.podPackageId || POD_PACKAGE_6X9_BW_PB,
          cover: { source_url: input.coverUrl },
          interior: { source_url: input.interiorUrl },
        },
      },
    ],
    shipping_address: input.shippingAddress,
    shipping_level: input.shippingLevel,
  };
  const r = await luluFetch<any>('/print-jobs/', { method: 'POST', body: JSON.stringify(body) });
  return { id: r.id, status: r.status?.name || r.status || 'CREATED', raw: r };
}

export async function getPrintJob(id: number | string): Promise<LuluPrintJob> {
  const r = await luluFetch<any>(`/print-jobs/${id}/`);
  return { id: r.id, status: r.status?.name || r.status || 'UNKNOWN', raw: r };
}

/** Best-effort cancel — only works before the job enters production. */
export async function cancelPrintJob(id: number | string): Promise<{ ok: boolean; status?: string }> {
  try {
    const r = await luluFetch<any>(`/print-jobs/${id}/status/`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'CANCELED' }),
    });
    return { ok: true, status: r?.name || r?.status?.name || 'CANCELED' };
  } catch {
    return { ok: false };
  }
}

/**
 * Verify a Lulu webhook HMAC-SHA256 over the raw body.
 * No secret set → fail CLOSED in production (reject), accept only in
 * non-production so the sandbox flow can run without the secret configured.
 */
export function verifyLuluWebhook(rawBody: Buffer, signatureHeader?: string): boolean {
  const secret = process.env.LULU_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[lulu webhook] LULU_WEBHOOK_SECRET is not set — rejecting webhook');
      return false;
    }
    return true;
  }
  if (!signatureHeader) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function extractWebhookJob(payload: any): { jobId: string; status: string } | null {
  const data = payload?.data ?? payload;
  const jobId = data?.id ?? data?.print_job_id;
  const status = data?.status?.name ?? data?.status ?? payload?.status;
  if (jobId == null || !status) return null;
  return { jobId: String(jobId), status: String(status) };
}
