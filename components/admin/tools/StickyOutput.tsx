// components/admin/tools/StickyOutput.tsx
'use client';

import * as React from 'react';

type Json = Record<string, any>;

export function StickyOutput({
  busyLabel,
  err,
  out,
}: {
  busyLabel?: string | null;
  err?: string | null;
  out?: Json | null;
}) {
  // SSR-safe initial value (must not read window/localStorage here)
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Restore saved preference after mount (default to open if nothing saved)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('adminToolsStickyOpen');
      setOpen(saved ? saved === '1' : true);
    } catch {
      // ignore
    }
  }, []);

  // Persist preference when it changes
  React.useEffect(() => {
    try {
      localStorage.setItem('adminToolsStickyOpen', open ? '1' : '0');
    } catch {
      // ignore
    }
  }, [open]);

  // Auto-open if new error or output arrives
  React.useEffect(() => {
    if ((err || out) && !open) setOpen(true);
  }, [err, out, open]);

  // Close with ESC
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const status = (() => {
    if (busyLabel) return { tone: 'busy' as const, text: `Working: ${busyLabel}…` };
    if (err) return { tone: 'error' as const, text: 'Error' };
    if (out) return { tone: 'ok' as const, text: 'Done' };
    return { tone: 'idle' as const, text: 'No output yet' };
  })();

  const copy = async () => {
    try {
      const payload = err ?? (out ? JSON.stringify(out, null, 2) : '');
      await navigator.clipboard.writeText(String(payload || ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-6xl px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="rounded-t-xl border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {status.tone === 'busy' ? (
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
                  aria-hidden
                />
              ) : (
                <span
                  className={[
                    'inline-block h-2.5 w-2.5 rounded-full',
                    status.tone === 'error'
                      ? 'bg-red-500'
                      : status.tone === 'ok'
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/40',
                  ].join(' ')}
                  aria-hidden
                />
              )}
              <span
                className={[
                  'select-none',
                  status.tone === 'error' ? 'text-red-600' : 'text-muted-foreground',
                ].join(' ')}
              >
                {status.text}
              </span>
              {status.tone === 'ok' && out && (
                <span className="text-xs text-muted-foreground">
                  {Object.keys(out).length} key{Object.keys(out).length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                onClick={copy}
                disabled={!err && !out}
                title="Copy JSON"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-controls="sticky-output-body"
              >
                {open ? 'Collapse' : 'Expand'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            id="sticky-output-body"
            className={[
              'transition-[max-height] duration-200 ease-out overflow-hidden border-t',
              open ? 'max-h-[55vh]' : 'max-h-0',
            ].join(' ')}
          >
            <div className="p-3">
              <pre
                className={[
                  'h-[38vh] w-full overflow-auto rounded bg-muted/40 p-3 text-xs',
                  err ? 'text-red-600' : '',
                ].join(' ')}
              >
{err
  ? err
  : out
  ? JSON.stringify(out, null, 2)
  : 'No output yet. Run a tool to see the response here.'}
              </pre>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Tip: Press <kbd>Esc</kbd> to collapse. The panel remembers your preference.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
