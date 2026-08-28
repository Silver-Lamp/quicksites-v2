'use client';

// The standard sign-in / sign-up controls. Use these instead of writing a link to /login.
//
// They exist so three things stop drifting: the destination (there is one auth route and it
// is easy to link to a 404 that sounds right), the label, and the styling. They also use
// next/link rather than a raw <a>, so an authenticated-looking header does not flash through
// a full document reload on the way to the form.

import Link from 'next/link';
import { signInHref, signUpHref, LABEL_SIGN_IN, LABEL_SIGN_UP } from '@/lib/auth/authLinks';

export type AuthVariant = 'primary' | 'secondary' | 'inline';

const VARIANT: Record<AuthVariant, string> = {
  // Filled. The one action you want taken on this surface — never two on the same screen.
  primary:
    'inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
  // Outlined. Sits beside a primary without competing with it.
  secondary:
    'inline-flex items-center justify-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
  // Text link, for prose and dense chrome.
  inline:
    'text-sm font-medium text-blue-400 underline-offset-4 transition-colors hover:text-blue-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
};

type Props = {
  /** Where to return after authenticating. Relative paths only; anything else is dropped. */
  next?: string | null;
  variant?: AuthVariant;
  /** Override the label only when the surrounding sentence demands it. */
  label?: string;
  className?: string;
};

export function SignInLink({ next, variant = 'inline', label, className }: Props) {
  return (
    <Link href={signInHref(next)} className={`${VARIANT[variant]} ${className ?? ''}`.trim()}>
      {label ?? LABEL_SIGN_IN}
    </Link>
  );
}

export function SignUpLink({ next, variant = 'primary', label, className }: Props) {
  return (
    <Link href={signUpHref(next)} className={`${VARIANT[variant]} ${className ?? ''}`.trim()}>
      {label ?? LABEL_SIGN_UP}
    </Link>
  );
}

/**
 * Both actions, in the order a logged-out visitor should read them: create an account is the
 * offer, signing in is for people who already accepted it.
 */
export function AuthLinks({ next, className }: { next?: string | null; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`.trim()}>
      <SignUpLink next={next} variant="primary" />
      <SignInLink next={next} variant="inline" />
    </div>
  );
}
