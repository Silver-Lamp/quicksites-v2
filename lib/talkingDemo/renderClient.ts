// lib/talkingDemo/renderClient.ts
//
// QS → HJ render client for Talking Demo Tier 2 (crosstalk/contracts/talking-demo-render.md).
// POSTs a QS-generated tour script to HJ's studio render endpoint on the partner-provisioning
// auth rails; narration is synchronous, MP4 is async (poll). Server-to-server ONLY.
//
// FAIL-CLOSED: throws TalkingDemoError(503) until PARTNER_QUICKSITES_SECRET is set — so this is
// inert until HJ ships the endpoint and the owner sets the shared secret on both sides. Mirrors the
// posture of lib/partners/audioProvisioning (which owns the canonical partner auth once merged).

import type { TalkingDemoScript, TalkingDemoRender } from './types';

const PARTNER_ID = 'quicksites';
const DEFAULT_HJ_BASE = 'https://hivejournalbackend-production.up.railway.app';
const TIMEOUT_MS = 20_000;

function hjBase(): string {
  return (process.env.HJ_BACKEND_URL || DEFAULT_HJ_BASE).replace(/\/+$/, '');
}
function partnerSecret(): string {
  return process.env.PARTNER_QUICKSITES_SECRET || '';
}

export class TalkingDemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'TalkingDemoError';
  }
}

function headers(grantToken?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Partner-Id': PARTNER_ID,
    'X-Partner-Key': partnerSecret(),
    ...(grantToken ? { 'X-Partner-Grant': grantToken } : {}),
  };
}

async function hjFetch(url: string, init: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw new TalkingDemoError(res.status, json?.error || json?.message || `HJ ${res.status}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Render a tour: narration returns immediately (cached per line); MP4 (if requested) comes back
 * `rendering` — poll pollTalkingDemo(). `grantToken` unlocks the owner's own cloned voice; without
 * it, house/narrator voice billed to the partner (the no-owner outreach case).
 */
export async function renderTalkingDemo(script: TalkingDemoScript, grantToken?: string): Promise<TalkingDemoRender> {
  if (!partnerSecret()) throw new TalkingDemoError(503, 'Talking Demo render not configured (PARTNER_QUICKSITES_SECRET unset)');
  return hjFetch(`${hjBase()}/api/partner/talking-demo/render`, {
    method: 'POST',
    headers: headers(grantToken),
    body: JSON.stringify(script),
  });
}

/** Poll a render instance for MP4 readiness. */
export async function pollTalkingDemo(instanceId: string, grantToken?: string): Promise<TalkingDemoRender> {
  if (!partnerSecret()) throw new TalkingDemoError(503, 'Talking Demo render not configured (PARTNER_QUICKSITES_SECRET unset)');
  return hjFetch(`${hjBase()}/api/partner/talking-demo/${encodeURIComponent(instanceId)}`, {
    method: 'GET',
    headers: headers(grantToken),
  });
}

/** True when the render rails are configured (the owner set the shared secret). */
export function talkingDemoRenderConfigured(): boolean {
  return !!partnerSecret();
}
