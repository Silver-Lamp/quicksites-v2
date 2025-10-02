'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type DrawerShellProps = {
  open: boolean;
  onClose: () => void;

  /** Title shown in header (optional). */
  title?: React.ReactNode;

  /** Main content (fills the drawer). */
  children: React.ReactNode;

  /** Optional footer (e.g., buttons). */
  footer?: React.ReactNode;

  /** Tailwind sizing for the drawer panel width. */
  className?: string;

  /** If true, clicking the backdrop closes the drawer. Default: true */
  closeOnBackdrop?: boolean;

  /** If true, pressing Escape closes the drawer. Default: true */
  closeOnEsc?: boolean;

  /** Optional: header right-side custom actions (besides the ✕). */
  headerActions?: React.ReactNode;
};

export default function DrawerShell({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnBackdrop = true,
  closeOnEsc = true,
  headerActions,
}: DrawerShellProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
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

    const root = drawerRef.current;
    root?.focus?.();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!root) return;

      if (closeOnEsc && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = root.querySelectorAll<HTMLElement>(
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
  }, [open, closeOnEsc, onClose]);

  // Restore focus after close
  useEffect(() => {
    if (open) return;
    lastActiveRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1250] flex"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={false}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={[
          'h-full bg-neutral-900 text-white border-l border-white/10 shadow-2xl',
          'flex flex-col outline-none w-[min(96vw,900px)] max-w-[900px]',
          className || '',
        ].join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-neutral-900/95 backdrop-blur">
          <div className="text-sm text-white/90 font-medium">{title}</div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm bg-white/10 hover:bg-white/20"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>

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
