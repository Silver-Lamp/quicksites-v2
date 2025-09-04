// ui/useHeroShortcuts.ts
// Global keyboard shortcuts for the hero preview.
// - Skips when typing in inputs/textareas or when a modal dialog has focus
// - Meta+K → open command palette
// - E → edit last hovered element (headline / subheadline / cta)
// - [ / ] → overlay level step (-1 / +1)
// - G → toggle grid

'use client';

import { useEffect } from 'react';

export type HoverTarget = 'headline' | 'subheadline' | 'cta_text' | 'stage' | null;

export function useHeroShortcuts(opts: {
  getHover: () => HoverTarget;
  onEdit: (field: 'headline' | 'subheadline' | 'cta_text') => void;
  onOverlayStep: (delta: -1 | 1) => void;
  onToggleGrid: () => void;
  onOpenPalette: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (editable || tag === 'input' || tag === 'textarea') return;

      // Cmd/Ctrl+K — command palette
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        opts.onOpenPalette();
        return;
      }

      // E — edit last hovered field
      if (!e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
        const h = opts.getHover();
        if (h && h !== 'stage') {
          e.preventDefault();
          opts.onEdit(h);
        }
        return;
      }

      // [ or ] — overlay step
      if (!e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        opts.onOverlayStep(e.key === '[' ? -1 : 1);
        return;
      }

      // G — toggle grid
      if (!e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        opts.onToggleGrid();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [opts]);
}
