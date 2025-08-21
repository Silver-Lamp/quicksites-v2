'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import TemplatesIndexTable from './templates-index-table';

const SKIP = /^(https?:\/\/|mailto:|tel:|javascript:|#)/i;

function Overlay({ show }: { show: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src="/logo_v1.png" alt="Loading…" className="h-12 w-auto opacity-95 animate-pulse" />
        <div className="h-8 w-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        <div className="text-white/80 text-sm">Loading…</div>
      </div>
    </div>,
    document.body
  );
}

type Props = {
  templates: any[];
  selectedFilter?: string;
};

export default function TemplatesIndexWithLoading({ templates, selectedFilter }: Props) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // hide overlay when the route changes
  useEffect(() => {
    if (loading) setLoading(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // capture pointer down before Next starts navigation
  const onPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    // only unmodified left button
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const target = e.target as HTMLElement;

    // 1) normal anchor
    const a = target.closest('a') as HTMLAnchorElement | null;
    if (a) {
      const href = a.getAttribute('href') || '';
      const tgt = (a.getAttribute('target') || '').toLowerCase();
      if (!href || SKIP.test(href) || (tgt && tgt !== '_self')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          // schedule so the overlay paints before nav
          requestAnimationFrame(() => setLoading(true));
        }
      } catch {/* ignore */}
      return;
    }

    // 2) row/card push handlers — look for data attributes on ancestors
    const carrier = target.closest('[data-nav-href],[data-href]') as HTMLElement | null;
    if (carrier) {
      const href = carrier.getAttribute('data-nav-href') || carrier.getAttribute('data-href') || '';
      if (!href || SKIP.test(href)) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          requestAnimationFrame(() => setLoading(true));
        }
      } catch {/* ignore */}
    }
  };

  return (
    <div ref={containerRef} onPointerDownCapture={onPointerDownCapture}>
      <TemplatesIndexTable templates={templates} selectedFilter={selectedFilter} />
      <Overlay show={loading} />
    </div>
  );
}
