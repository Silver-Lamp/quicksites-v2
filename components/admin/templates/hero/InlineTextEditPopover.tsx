'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Minimal, dependency‑free inline editor popover.
 * Renders an absolute card near an anchor rect. Use getBoundingClientRect() of the target element.
 */
export type InlineTextEditPopoverProps = {
  open: boolean;
  /** Anchor rect in viewport coordinates */
  anchorRect?: DOMRect | null;
  label: string;
  initial: string;
  placeholder?: string;
  maxLength?: number;
  onChange?: (v: string) => void; // live change
  onSave: (v: string) => void;
  onClose: () => void;
};

export default function InlineTextEditPopover({ open, anchorRect, label, initial, placeholder, maxLength = 140, onChange, onSave, onClose }: InlineTextEditPopoverProps) {
  const [value, setValue] = useState(initial || '');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setValue(initial || ''), [initial]);

  // click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const top = Math.max(12, anchorRect.bottom + window.scrollY + 8);
  const left = Math.min(window.innerWidth - 320 - 12, Math.max(12, anchorRect.left + window.scrollX));

  return (
    <div
      ref={cardRef}
      className="fixed z-[80] w-[320px] rounded-xl border border-white/15 bg-[#0f1115] text-white shadow-xl"
      style={{ top, left }}
      role="dialog"
      aria-label={`${label} editor`}
    >
      <div className="px-3 py-2 text-xs text-white/70 border-b border-white/10">Edit {label}</div>
      <div className="p-3 space-y-2">
        <textarea
          className="w-full h-24 rounded-md bg-white/10 border border-white/15 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/40"
          value={value}
          onChange={(e) => { setValue(e.target.value); onChange?.(e.target.value); }}
          maxLength={maxLength}
          placeholder={placeholder}
        />
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>{value.length}/{maxLength}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-2 py-1 rounded-md border border-white/20 bg-white/5 hover:bg-white/10">Cancel</button>
            <button onClick={() => onSave(value)} className="px-2 py-1 rounded-md bg-white text-gray-900">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
