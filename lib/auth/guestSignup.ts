// lib/auth/guestSignup.ts
//
// The guest → account step, as small pure pieces every surface shares.
//
// ⚠️ 0 of 16 guest builders converted between July and 2026-09-13 (docs/GUEST_SIGNUP_PLAN.md).
// Three surfaces each did part of the job and none finished it: the banner had the form but
// scrolled away; the toolbar had the words but no button; Publish called an admin-only route and
// said "Failed to publish". One event, one box, one redirect — used by all three.

/** Dispatched (window) when any surface wants the sign-up box open. */
export const GUEST_SIGNUP_EVENT = 'qs:guest:signup';

/** The API code the server returns to an anonymous caller who must sign up first. */
export const NEEDS_SIGNUP_CODE = 'needs_signup';

/** Is this a "sign up first" refusal? Both the status and the code, so a real 401 stays a 401. */
export function isNeedsSignup(status: number, body: unknown): boolean {
  return status === 401 && !!body && typeof body === 'object' && (body as { code?: unknown }).code === NEEDS_SIGNUP_CODE;
}

/** `/admin/templates/<id>` from an editor pathname, or null anywhere else. */
export function editorPathFromPathname(pathname: string): string | null {
  const m = pathname.match(/^\/admin\/templates\/([^/?#]+)/);
  const id = m?.[1];
  if (!id || ['list', 'new', 'gsc-bulk-stats'].includes(id)) return null;
  return `/admin/templates/${id}`;
}

/**
 * Where the confirmation email brings them back to: the auth callback, then THEIR EDITOR — never
 * the Site URL (the homepage), which is where the first version landed people with no way back
 * to the site they had built. The callback finalises fragment tokens on any device.
 */
export function guestSignupRedirectUrl(origin: string, editorPath: string | null): string {
  const next = editorPath ?? '/admin/templates/list';
  return `${origin.replace(/\/+$/, '')}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Minimum password we accept when a guest sets one alongside their email. */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

/** Client-side: ask whatever is mounted to open the sign-up box. Safe to call anywhere. */
export function requestGuestSignup(reason?: string): void {
  try {
    window.dispatchEvent(new CustomEvent(GUEST_SIGNUP_EVENT, { detail: { reason: reason ?? null } }));
  } catch {
    /* SSR / no window */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// "We've sent the confirmation" — shared, because THREE surfaces ask for the sign-up.
//
// ⚠️ After submitting, a guest saw the green "Check <email> to confirm" message AND, at the same
// time, "Sign up to publish your site" in the banner beside it and "Sign up to publish" in the
// toolbar below. Three surfaces, one of them announcing success while the other two asked again —
// which reads as "that didn't work, try again" at the exact moment we need them to go and check
// their inbox.
//
// The form's own `status === 'sent'` is local to one copy of the form. The banner and the toolbar
// are separate components, so the fact has to travel.
// ─────────────────────────────────────────────────────────────────────────────

/** Dispatched (window) once the confirmation email is on its way. */
export const GUEST_SIGNUP_SENT_EVENT = 'qs:guest:signup-sent';

/**
 * ⚠️ sessionStorage, not state: the confirmation lives in another tab (their inbox), and people
 * reload. A reload that brings "Sign up to publish" back would undo the whole point. It is
 * SESSION-scoped rather than local because the pending state ends when they confirm, and a stale
 * "check your email" a week later would be worse than the prompt.
 */
const SENT_KEY = 'qs:guest:signup-sent';

export function markGuestSignupSent(): void {
  try {
    window.sessionStorage.setItem(SENT_KEY, '1');
  } catch {
    /* private window / blocked storage — the event below still covers this tab */
  }
  try {
    window.dispatchEvent(new CustomEvent(GUEST_SIGNUP_SENT_EVENT));
  } catch {
    /* SSR */
  }
}

export function guestSignupSent(): boolean {
  try {
    return window.sessionStorage.getItem(SENT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Clear it once they are a real account — otherwise the notice outlives its truth. */
export function clearGuestSignupSent(): void {
  try {
    window.sessionStorage.removeItem(SENT_KEY);
  } catch {
    /* no-op */
  }
}
