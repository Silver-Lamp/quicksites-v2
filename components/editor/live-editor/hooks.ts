'use client';

import { useEffect, useState } from 'react';
import { getPages } from '@/components/editor/live-editor/helpers';

export function useSelectedPageId(pages: any[], storageKey: string) {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) return saved;
    }
    return pages?.[0]?.id ?? null;
  });

  useEffect(() => {
    if (selectedPageId && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, selectedPageId);
    }
  }, [selectedPageId, storageKey]);

  useEffect(() => {
    if (!pages?.length) return;
    if (!selectedPageId || !pages.some((p) => p.id === selectedPageId)) {
      setSelectedPageId(pages[0]?.id ?? null);
    }
  }, [pages, selectedPageId]);

  const selectedPageIndex = Math.max(0, pages.findIndex((p) => p.id === selectedPageId));
  const selectedPage = pages[selectedPageIndex] ?? null;

  return { selectedPageId, setSelectedPageId, selectedPageIndex, selectedPage };
}

export function useImmersive() {
  const [isImmersive, setIsImmersive] = useState(false);

  function scrollToEl(el?: HTMLElement | null) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const current = window.pageYOffset || document.documentElement.scrollTop || 0;
    const top = current + rect.top - 24;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  async function enterImmersive() {
    try {
      const el: any = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as any);
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
      setIsImmersive(true);
      setTimeout(() => scrollToEl(document.querySelector('[data-block-id]') as HTMLElement | null), 10);
    } catch {
      setIsImmersive(true);
      setTimeout(() => scrollToEl(document.querySelector('[data-block-id]') as HTMLElement | null), 10);
    }
  }

  async function exitImmersive() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else if ((document as any).webkitFullscreenElement) {
        (document as any).webkitExitFullscreen?.();
      }
    } finally {
      setIsImmersive(false);
    }
  }

  useEffect(() => {
    const sync = () => {
      const active =
        !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsImmersive(active);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as any);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as any);
    };
  }, []);

  return { isImmersive, enterImmersive, exitImmersive };
}
