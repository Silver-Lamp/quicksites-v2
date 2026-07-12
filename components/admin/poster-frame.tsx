'use client';

// components/admin/poster-frame.tsx
// Renders the postcard's self-contained front/back HTML in isolated iframes (so their
// print styles don't leak into the admin chrome), with a Front/Back toggle and a
// Print / Save-PDF button. When a back is supplied this doubles as the Lob proof preview.

import { useRef, useState } from 'react';

export default function PosterFrame({ html, backHtml }: { html: string; backHtml?: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const current = side === 'back' && backHtml ? backHtml : html;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {backHtml && (
          <div className="inline-flex overflow-hidden rounded-lg border border-neutral-700">
            {(['front', 'back'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`px-3 py-2 text-sm capitalize ${
                  side === s ? 'bg-sky-600 text-white' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => ref.current?.contentWindow?.print()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Print / Save PDF
        </button>
        {backHtml && <span className="text-xs text-neutral-500">6×9 postcard · what Lob mails</span>}
      </div>
      <iframe
        ref={ref}
        srcDoc={current}
        title={`Competition postcard — ${side}`}
        className="h-[9.4in] w-[6.2in] rounded-lg border border-neutral-800 bg-white"
      />
    </div>
  );
}
