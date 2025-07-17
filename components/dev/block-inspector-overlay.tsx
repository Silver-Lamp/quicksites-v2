'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

type HoverData = {
  id: string;
  type: string;
  rect: DOMRect;
};

export default function BlockInspectorOverlay() {
  const [hover, setHover] = useState<HoverData | null>(null);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!e.altKey) return setHover(null);

      const el = (e.target as HTMLElement)?.closest('[data-block-id]');
      if (!el) return setHover(null);

      const id = el.getAttribute('data-block-id') || 'unknown';
      const type = el.getAttribute('data-block-type') || 'unknown';
      const rect = el.getBoundingClientRect();

      setHover({ id, type, rect });
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!hover) return null;

  return createPortal(
    <>
      {/* 🟪 Floating tooltip */}
      <div
        className="fixed z-50 bg-black text-white text-xs px-2 py-1 rounded shadow pointer-events-none"
        style={{ top: hover.rect.top + 8, left: hover.rect.left + 8 }}
      >
        🧱 <strong>{hover.type}</strong> — <code>{hover.id}</code>
      </div>

      {/* 🟦 Outline overlay */}
      <div
        className={clsx(
          'fixed z-40 pointer-events-none border-2 border-purple-500 rounded-md animate-pulse',
        )}
        style={{
          top: hover.rect.top - 2,
          left: hover.rect.left - 2,
          width: hover.rect.width + 4,
          height: hover.rect.height + 4,
        }}
      />
    </>,
    document.body
  );
}
