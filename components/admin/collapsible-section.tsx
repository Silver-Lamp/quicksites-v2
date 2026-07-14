'use client';

// components/admin/collapsible-section.tsx
//
// A section with a clickable header that collapses its body. Open/closed state is
// persisted per-section in localStorage so an operator's layout survives reloads.
// Long bodies can opt into an internal scroll region (`scroll` + `bodyMaxClass`) so a
// growing list caps its height instead of stretching the whole page. Other code can
// force a section open (e.g. before scrolling to a row inside it) via `openSection(id)`.

import { useEffect, useState, type ReactNode } from 'react';

const OPEN_EVENT = 'qs:section:open';

/** Force the section with this id open (used before scrolling to a row inside it). */
export function openSection(id: string) {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id } }));
  } catch {
    /* SSR / no window */
  }
}

export default function CollapsibleSection({
  id,
  title,
  subtitle,
  count,
  right,
  defaultOpen = true,
  scroll = false,
  bodyMaxClass = 'max-h-[32rem]',
  className = '',
  children,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional count pill next to the title (e.g. number of rows). */
  count?: number | null;
  /** Header-right slot for section-scoped actions — stays visible while collapsed. */
  right?: ReactNode;
  defaultOpen?: boolean;
  /** Wrap the body in a vertical-scroll region capped by `bodyMaxClass`. */
  scroll?: boolean;
  bodyMaxClass?: string;
  className?: string;
  children: ReactNode;
}) {
  const storeKey = `qs:section-open:${id}`;
  const [open, setOpen] = useState(defaultOpen);

  // Restore persisted state on mount.
  useEffect(() => {
    try {
      const v = localStorage.getItem(storeKey);
      if (v != null) setOpen(v === '1');
    } catch {
      /* ignore */
    }
  }, [storeKey]);

  // Let other code force this section open (openSection(id)).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id === id) {
        setOpen(true);
        try { localStorage.setItem(storeKey, '1'); } catch { /* ignore */ }
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(OPEN_EVENT, onOpen as EventListener);
  }, [id, storeKey]);

  const toggle = () =>
    setOpen((o) => {
      const n = !o;
      try { localStorage.setItem(storeKey, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });

  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={toggle}
          aria-expanded={open}
          className="group flex min-w-0 items-center gap-2 text-left"
          title={open ? 'Collapse' : 'Expand'}
        >
          <span className={`shrink-0 text-[11px] text-neutral-500 transition-transform group-hover:text-neutral-300 ${open ? 'rotate-90' : ''}`}>
            ▸
          </span>
          <h2 className="truncate text-sm font-semibold uppercase tracking-wide text-neutral-400 group-hover:text-neutral-300">
            {title}
          </h2>
          {count != null && (
            <span className="shrink-0 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">{count}</span>
          )}
        </button>
        {right ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{right}</div> : null}
      </div>

      {open && (
        <>
          {subtitle ? <p className="mt-1 text-xs text-neutral-500">{subtitle}</p> : null}
          <div className={scroll ? `mt-3 overflow-y-auto ${bodyMaxClass} pr-1` : 'mt-3'}>{children}</div>
        </>
      )}
    </section>
  );
}
