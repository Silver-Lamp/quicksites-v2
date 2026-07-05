'use client';

// Small client helper: shows the merchant's public store URL and copies the
// absolute link (origin + path) to the clipboard. The parent (a server
// component) only knows the path; the origin is resolved in the browser.
import * as React from 'react';

export default function CopyStoreLink({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false);
  const [href, setHref] = React.useState(path);

  React.useEffect(() => {
    setHref(`${window.location.origin}${path}`);
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the visible link is still selectable */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-black/30 px-2 py-1 text-sm text-sky-200 break-all">{href}</code>
      <button
        type="button"
        onClick={copy}
        className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-200 hover:bg-sky-500/20"
      >
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-white/15 px-3 py-1 text-sm text-white/80 hover:bg-white/5"
      >
        View store ↗
      </a>
    </div>
  );
}
