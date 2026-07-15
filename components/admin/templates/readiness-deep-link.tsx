'use client';

// components/admin/templates/readiness-deep-link.tsx
//
// Honors the `?reveal=<blockType>` deep link the templates list uses for its
// "next step" button: on load, scroll to + spotlight the first block of that type
// in the live preview (mirrors the Readiness coach's reveal). Renders nothing.

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTemplateEditor } from '@/context/template-editor-context';

/** First block id whose type matches (canonical content_blocks, legacy blocks fallback). */
function findBlockId(data: any, type: string): string | null {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      if (b?.type === type) return b?._id ?? b?.id ?? null;
    }
  }
  return null;
}

export default function ReadinessDeepLink() {
  const params = useSearchParams();
  const reveal = params.get('reveal');
  const ctx = useTemplateEditor();
  const data = (ctx as any)?.template?.data;
  const done = useRef(false);

  useEffect(() => {
    if (!reveal || done.current) return;
    const blockId = findBlockId(data, reveal);
    if (!blockId) return;
    done.current = true;

    const esc = (globalThis as any).CSS?.escape ?? ((s: string) => s.replace(/"/g, '\\"'));
    let tries = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${esc(blockId)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-fuchsia-500', 'ring-offset-2', 'ring-offset-zinc-900');
        setTimeout(() => el.classList.remove('ring-2', 'ring-fuchsia-500', 'ring-offset-2', 'ring-offset-zinc-900'), 1600);
        return;
      }
      if (tries++ < 24) setTimeout(tick, 250); // preview mounts async — retry ~6s
    };
    tick();
  }, [reveal, data]);

  return null;
}
