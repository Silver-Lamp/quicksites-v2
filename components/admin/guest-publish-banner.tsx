// components/admin/guest-publish-banner.tsx
'use client';

import { useEffect, useState } from 'react';
import CharacterAvatar from '@/components/brand/CharacterAvatar';
import Typewriter from '@/components/ui/typewriter';
import { GuestSignupForm } from '@/components/admin/guest-signup-box';
import { requestGuestSignup } from '@/lib/auth/guestSignup';
import { trackGuestFunnel } from '@/lib/analytics/guestFunnel';

const GUEST_LINE = 'You’re building as a guest. Sign up to publish your site — your work is saved.';

/** Build a shareable, watermarked preview URL from the current editor path. */
function buildPreviewUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/admin\/templates\/([^/]+)/);
  const id = m?.[1];
  if (!id || ['list', 'new', 'gsc-bulk-stats'].includes(id)) return null;
  // No &watermark=1 needed — the preview shows the "not yet published" mark based
  // on the template's published state (DB-driven).
  return `${window.location.origin}/preview?template_id=${encodeURIComponent(id)}`;
}

/**
 * Persistent banner shown while building as a guest (anonymous user).
 *
 * The form itself is the shared GuestSignupForm (components/admin/guest-signup-box.tsx) —
 * the same one the toolbar button and a refused Publish open as a modal. This banner sits in
 * normal flow below the sticky header and scrolls out of view, which is why it is no longer
 * the only place to sign up (docs/GUEST_SIGNUP_PLAN.md).
 */
export default function GuestPublishBanner() {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The guide "types" the intro once, then it settles into the interactive version.
  const [typed, setTyped] = useState(false);

  useEffect(() => {
    setPreviewUrl(buildPreviewUrl());
    // ⚠️ THE DENOMINATOR. Every other number in this funnel is meaningless without it: a zero
    // click-through means one thing if 40 people saw the banner and something entirely different
    // if it never rendered. Fired once per mount, from the banner itself, so it cannot drift out
    // of step with whether the thing was actually on screen.
    trackGuestFunnel('prompt_shown', { surface: 'banner' });
  }, []);

  const copyPreview = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the Preview link still works */
    }
  };

  return (
    <div className="w-full border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <CharacterAvatar size={30} />
          {typed ? (
            <span className="text-sky-100">
              You’re building as a guest.{' '}
              <button
                type="button"
                onClick={() => requestGuestSignup('banner')}
                className="font-medium text-sky-300 underline-offset-2 transition hover:text-sky-200 hover:underline"
              >
                Sign up to publish your site
              </button>{' '}
              — your work is saved.
            </span>
          ) : (
            <Typewriter text={GUEST_LINE} className="text-sky-100" onDone={() => setTyped(true)} />
          )}
        </div>

        {!open ? (
          <div className="flex shrink-0 items-center gap-2">
            {previewUrl && (
              <>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-sky-500/40 px-3 py-1.5 font-medium text-sky-200 transition hover:bg-sky-500/10"
                >
                  Preview
                </a>
                <button
                  type="button"
                  onClick={copyPreview}
                  className="rounded-md border border-sky-500/40 px-3 py-1.5 font-medium text-sky-200 transition hover:bg-sky-500/10"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                // This one opens the form inline rather than dispatching GUEST_SIGNUP_EVENT, so
                // the modal's own tracking never sees it — it has to be recorded here or the
                // banner's primary button is the one click in the funnel that goes uncounted.
                trackGuestFunnel('signup_opened', { surface: 'banner_inline' });
                setOpen(true);
              }}
              className="rounded-md bg-sky-500 px-4 py-1.5 font-medium text-zinc-950 transition hover:bg-sky-400"
            >
              Sign up to publish
            </button>
          </div>
        ) : (
          <div className="shrink-0">
            <GuestSignupForm compact surface="banner_inline" />
          </div>
        )}
      </div>
    </div>
  );
}
