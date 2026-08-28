// lib/auth/authLinks.ts
//
// One place that decides where "sign in" and "sign up" go, and what they are called.
//
// Before this, the app had: /login, /register, /sign-up and /signup in use — and only the
// first existed. Two upgrade prompts sent a user who was trying to PAY US to a 404. The
// labels drifted too ("Log In", "Log in", "Sign in", "Sign up", "Get started", "Create
// account"), and the return-URL parameter was written two ways.
//
// There is ONE auth surface: /login. It handles both signing in and creating an account,
// so "sign up" is the same route with an intent, not a second page. Keep it that way — the
// moment a second auth route exists, half the app links to the wrong one.

/** The only auth route. Everything else redirects here (see next.config.js). */
export const AUTH_PATH = '/login';

/** The return-URL parameter. `redirectTo` is still READ by the login form for old links. */
export const NEXT_PARAM = 'next';

/** Where someone lands after signing in with no destination of their own. */
export const DEFAULT_NEXT = '/admin/templates/list';

/**
 * Signals the form should lead with account creation. The route is the same either way —
 * a visitor who meant to sign in is one click from it, rather than one 404 from it.
 */
export const SIGNUP_INTENT = 'intent=signup';

/** Canonical labels. Sentence case, and the same verb everywhere. */
export const LABEL_SIGN_IN = 'Sign in';
export const LABEL_SIGN_UP = 'Sign up';

/** Paths that must never be linked to: they 404 and always have. */
export const DEAD_AUTH_PATHS = ['/register', '/sign-up', '/signup', '/sign-in'] as const;

function withNext(base: string, next?: string | null): string {
  const n = (next ?? '').trim();
  if (!n) return base;
  // Only relative destinations. An absolute URL here is an open redirect: sign the user in
  // and hand them to someone else's page carrying whatever the referrer leaks.
  if (!n.startsWith('/') || n.startsWith('//')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${NEXT_PARAM}=${encodeURIComponent(n)}`;
}

/** Href for signing in, optionally returning to `next` afterwards. */
export function signInHref(next?: string | null): string {
  return withNext(AUTH_PATH, next);
}

/** Href for creating an account, optionally returning to `next` afterwards. */
export function signUpHref(next?: string | null): string {
  return withNext(`${AUTH_PATH}?${SIGNUP_INTENT}`, next);
}
