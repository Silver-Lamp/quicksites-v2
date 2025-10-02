'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalShellProps = {
  open: boolean;
  onClose: () => void;

  /** Title shown in header (optional). */
  title?: React.ReactNode;

  /** Main content */
  children: React.ReactNode;

  /** Optional footer (e.g., buttons). */
  footer?: React.ReactNode;

  /** Tailwind width/height constraints. */
  className?: string;

  /** If true, clicking the backdrop closes the modal. Default: true */
  closeOnBackdrop?: boolean;

  /** If true, pressing Escape closes the modal. Default: true */
  closeOnEsc?: boolean;

  /** Focus this element on open (falls back to the modal root). */
  initialFocusRef?: React.RefObject<HTMLElement>;

  /** Optional: header right-side custom actions (besides the ✕). */
  headerActions?: React.ReactNode;
};

export default function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnBackdrop = true,
  closeOnEsc = true,
  initialFocusRef,
  headerActions,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const html = document.documentElement;
    html.style.setProperty('scrollbar-gutter', 'stable');
    const prevOverflow = body.style.overflow;
    const prevPadRight = body.style.paddingRight;

    const scrollbar = window.innerWidth - html.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    body.style.overflow = 'hidden';

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadRight;
    };
  }, [open]);

  // Focus management + simple focus trap
  useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement as HTMLElement | null;

    const root = dialogRef.current;
    const focusTarget = initialFocusRef?.current ?? root;
    focusTarget?.focus?.();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!root) return;

      if (closeOnEsc && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = root.querySelectorAll<HTMLElement>(
          // Inputs, buttons, links, etc. (minus disabled/hidden)
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), ' +
            'button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable=true]'
        );
        const list = Array.from(focusables).filter(
          (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
        );
        if (list.length === 0) return;

        const currentIndex = list.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex;

        if (e.shiftKey) {
          nextIndex = currentIndex <= 0 ? list.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === list.length - 1 ? 0 : currentIndex + 1;
        }

        if (currentIndex === -1) {
          // Nothing inside focused yet: send to first.
          list[0].focus();
          e.preventDefault();
        } else {
          list[nextIndex].focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [open, closeOnEsc, onClose, initialFocusRef]);

  // Restore focus after close
  useEffect(() => {
    if (open) return;
    lastActiveRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={false}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={[
          'overflow-hidden rounded-lg border border-white/10 bg-neutral-950 text-white outline-none',
          'w-[min(92vw,1000px)] max-w-[1000px] max-h-[85vh] flex flex-col',
          className || '',
        ].join(' ')}
        onMouseDown={(e) => e.stopPropagation()} // prevent backdrop close when clicking inside
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 bg-neutral-900/70">
          <div className="text-sm font-medium">{title}</div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm bg-white/10 hover:bg-white/20"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto p-2">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-2 bg-neutral-900/70">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
