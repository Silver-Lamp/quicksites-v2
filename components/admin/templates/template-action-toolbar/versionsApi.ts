'use client';

import { isNeedsSignup, requestGuestSignup } from '@/lib/auth/guestSignup';

export async function loadVersionRow(id: string) {
  const res = await fetch(`/api/templates/versions?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  // Shape is repo-specific; keeping it generic
  return json?.items?.[0] ?? json;
}

export async function createSnapshot(templateId: string) {
  const url = `/api/admin/snapshots/create?templateId=${encodeURIComponent(templateId)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export async function publishSnapshot(templateId: string, snapshotId: string) {
  const url = `/api/admin/sites/publish?templateId=${encodeURIComponent(templateId)}&snapshotId=${encodeURIComponent(snapshotId)}&versionId=${encodeURIComponent(snapshotId)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  // ⚠️ The moment of intent. A guest pressing Publish used to get "Failed to publish" (the route
  // was admin-only) — a dead end at the one instant they wanted an account. Every publish surface
  // goes through here, so this is where a `needs_signup` refusal opens the sign-up box.
  if (isNeedsSignup(res.status, json)) {
    requestGuestSignup('publish');
    throw new Error('Sign up to publish — it’s free, and your site stays exactly as it is.');
  }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}
