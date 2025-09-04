// ==============================
// File: components/admin/templates/hero/HeroCommandPalette.tsx
// Description: Lightweight command palette focused on hero actions. Opens with ⌘K/CTRL+K by default.
// ==============================

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { commandPalette as paletteFx } from '@/ui/motion';
import { zIndex } from '@/ui/uiTokens';

export type PaletteAction = {
  id: string;
  label: string;
  keywords?: string[];
  section?: string;
  shortcut?: string;
  onSelect: () => void;
};

export type HeroCommandPaletteProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  actions: PaletteAction[];
  placeholder?: string;
};

export default function HeroCommandPalette({ isOpen, onOpenChange, actions, placeholder = 'Type a command…' }: HeroCommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const metaK = (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey));
      if (metaK) { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }
      if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(a => [a.label, ...(a.keywords || [])].join(' ').toLowerCase().includes(q));
  }, [actions, query]);

  useEffect(() => { setIndex(0); }, [query, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); filtered[index]?.onSelect(); setOpen(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: zIndex.palette }}
            variants={paletteFx}
            initial="scrimInitial"
            animate="scrimAnimate"
            exit="scrimInitial"
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="fixed left-1/2 top-24 -translate-x-1/2 w-full max-w-xl rounded-2xl overflow-hidden border border-white/10 bg-[#0f1115] shadow-2xl"
            style={{ zIndex: zIndex.palette + 1 }}
            variants={paletteFx}
            initial="panelInitial"
            animate="panelAnimate"
            exit="scrimInitial"
          >
            <div className="p-3 border-b border-white/10">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className="w-full bg-white/10 text-white placeholder-white/40 text-sm px-3 py-2 rounded-md outline-none"
              />
            </div>
            <ul className="p-2 text-sm max-h-[50vh] overflow-auto">
              {filtered.length === 0 && (
                <li className="px-3 py-4 text-white/50">No results</li>
              )}
              {filtered.map((a, i) => (
                <li
                  key={a.id}
                  className={`px-3 py-2 rounded-md cursor-pointer ${i === index ? 'bg-white/10 text-white' : 'text-white/90 hover:bg-white/5'}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => { a.onSelect(); setOpen(false); }}
                >
                  <div className="flex items-center justify-between">
                    <span>{a.label}</span>
                    {a.shortcut && <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/15">{a.shortcut}</kbd>}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper to build a default hero palette that triggers your existing events
export function makeHeroActions(): PaletteAction[] {
  const fire = (name: string, detail?: any) => window.dispatchEvent(new CustomEvent(name, { detail }));
  return [
    { id: 'edit_headline', label: 'Edit Headline', keywords: ['headline','h1','text'], onSelect: () => fire('qs:hero:focus', { field: 'headline' }) },
    { id: 'rewrite_sub_friendly', label: 'Rewrite Subheadline (friendly)', keywords: ['ai','subheadline','rewrite'], onSelect: () => fire('qs:hero:ai-rewrite', { field: 'subheadline', tone: 'friendly' }) },
    { id: 'swap_layout_split', label: 'Swap to Split Layout', keywords: ['layout','split'], onSelect: () => fire('qs:hero:set-layout', { layout: 'split' }) },
    { id: 'generate_image', label: 'Generate Hero Image ✨', keywords: ['image','generate','ai'], onSelect: () => fire('qs:hero:generate-image') },
    { id: 'increase_overlay', label: 'Increase Overlay', keywords: ['overlay','contrast'], onSelect: () => fire('qs:hero:set-overlay', { step: +1 }) },
    { id: 'decrease_overlay', label: 'Decrease Overlay', keywords: ['overlay','contrast'], onSelect: () => fire('qs:hero:set-overlay', { step: -1 }) },
    { id: 'preview_mobile', label: 'Preview – Mobile', keywords: ['preview','device','mobile'], onSelect: () => fire('qs:app:preview-device', { device: 'mobile' }) },
    { id: 'save', label: 'Save Template', shortcut: '⌘S', keywords: ['save','commit'], onSelect: () => fire('qs:toolbar:save-now', { source: 'palette' }) },
  ];
}
