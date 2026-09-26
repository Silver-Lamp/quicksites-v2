'use client';

import toast from 'react-hot-toast';
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

  // ⚠️ SAY THE DEADLINE OUT LOUD, EVERY TIME. A grace publish puts a real site live on a clock; if
  // nobody is told, the site simply vanishes in a week and the first they know of it is a customer
  // asking why their page is gone. The toast is the only moment we have their attention, so the
  // route returns `graceUntil` and this refuses to drop it silently.
  if (json?.graceUntil) {
    const days = graceDaysLeft(json.graceUntil);
    toast.success(
      days > 0
        ? `Your site is live. Confirm your email within ${days} day${days === 1 ? '' : 's'} to keep it up.`
        : 'Your site is live. Confirm your email to keep it up.',
      { duration: 10_000 },
    );
  }
  return json;
}

/** Whole days until the grace window closes, floored at 0. */
function graceDaysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
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
