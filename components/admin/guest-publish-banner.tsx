// components/admin/guest-publish-banner.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

/** Build a shareable, watermarked preview URL from the current editor path. */
function buildPreviewUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(/\/admin\/templates\/([^/]+)/);
  const id = m?.[1];
  if (!id || ['list', 'new', 'gsc-bulk-stats'].includes(id)) return null;
  return `${window.location.origin}/preview?template_id=${encodeURIComponent(id)}&watermark=1`;
}

/**
 * Persistent banner shown while building as a guest (anonymous user).
 *
 * "Sign up to publish" upgrades the anonymous user IN PLACE via
 * supabase.auth.updateUser({ email }) — this keeps the SAME uid, so the draft
 * they already own is theirs the moment they confirm. (A fresh login would mint
 * a different uid and orphan the draft, which is why we don't link to /login.)
 *
 * NOTE: the anon→permanent upgrade requires "Allow anonymous sign-ins" enabled
 * in the Supabase project; until then this path can't be exercised end-to-end.
 */
export default function GuestPublishBanner() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPreviewUrl(buildPreviewUrl());
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setStatus('sending');
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: addr });
      if (error) {
        setStatus('error');
        setMessage(error.message || 'Could not start signup. Please try again.');
        return;
      }
      setStatus('sent');
      setMessage(`Check ${addr} to confirm your account, then come back to publish.`);
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="w-full border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sky-100">
          👋 You’re building as a guest.{' '}
          <span className="text-sky-300">Sign up to publish your site</span> — your work is saved.
        </span>

        {status === 'sent' ? (
          <span className="text-emerald-300">{message}</span>
        ) : !open ? (
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
              onClick={() => setOpen(true)}
              className="rounded-md bg-sky-500 px-4 py-1.5 font-medium text-zinc-950 transition hover:bg-sky-400"
            >
              Sign up to publish
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex shrink-0 items-center gap-2">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              disabled={status === 'sending'}
              className="w-56 rounded-md border border-sky-500/40 bg-zinc-900/70 px-3 py-1.5 text-white placeholder:text-zinc-500 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-md bg-sky-500 px-3 py-1.5 font-medium text-zinc-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending…' : 'Continue'}
            </button>
          </form>
        )}
      </div>
      {status === 'error' && message && (
        <p className="mx-auto mt-1 max-w-6xl text-red-300" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
