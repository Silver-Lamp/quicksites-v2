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
  // panel open state
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // prevents auto-open from re-opening the same payload after user collapses
  const [snoozeAutoOpen, setSnoozeAutoOpen] = React.useState(false);

  // Restore saved preference after mount (default to open if nothing saved)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('adminToolsStickyOpen');
      setOpen(saved ? saved === '1' : true);
    } catch { /* ignore */ }
  }, []);

  // Persist preference when it changes
  React.useEffect(() => {
    try {
      localStorage.setItem('adminToolsStickyOpen', open ? '1' : '0');
    } catch { /* ignore */ }
  }, [open]);

  // Build a lightweight signature for the current "payload".
  // When this changes, we clear the snooze so auto-open can work again.
  const payloadKey = React.useMemo(() => {
    if (err) return `err:${err}`;
    if (out) {
      // try to use a stable-ish identifier before falling back to key set
      const idish =
        (out.id as string) ??
        (out.meal_id as string) ??
        (out.chef_id as string) ??
        (out.merchant_id as string) ??
        Object.keys(out).sort().join(',');
      return `out:${idish}`;
    }
    if (busyLabel) return `busy:${busyLabel}`;
    return 'none';
  }, [err, out, busyLabel]);

  // New payload -> allow auto-open again
  React.useEffect(() => {
    setSnoozeAutoOpen(false);
  }, [payloadKey]);

  // Auto-open only if we have output/error AND snooze is not active
  React.useEffect(() => {
    if (!snoozeAutoOpen && (err || out)) {
      setOpen(true);
    }
  }, [payloadKey, snoozeAutoOpen, err, out]);

  // Collapse with ESC (and snooze)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        collapse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const collapse = React.useCallback(() => {
    setOpen(false);
    setSnoozeAutoOpen(true); // <- critical: don't auto-open again for this payload
    try {
      localStorage.setItem('adminToolsStickyOpen', '0');
    } catch { /* ignore */ }
  }, []);

  const expand = React.useCallback(() => {
    setSnoozeAutoOpen(false);
    setOpen(true);
    try {
      localStorage.setItem('adminToolsStickyOpen', '1');
    } catch { /* ignore */ }
  }, []);

  const toggle = React.useCallback(() => {
    if (open) collapse();
    else expand();
  }, [open, collapse, expand]);

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
                onClick={toggle}
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
                Tip: Press <kbd>Esc</kbd> to collapse. The panel won’t auto-reopen until a new result arrives.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
