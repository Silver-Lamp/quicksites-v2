'use client';

// components/admin/poster-frame.tsx
// Renders a self-contained poster HTML doc in an isolated iframe (so its print styles
// don't leak into the admin chrome) with a Print / Save-PDF button.

import { useRef } from 'react';

export default function PosterFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => ref.current?.contentWindow?.print()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Print / Save PDF
        </button>
      </div>
      <iframe ref={ref} srcDoc={html} title="Competition poster" className="h-[9.4in] w-[6.2in] rounded-lg border border-neutral-800 bg-white" />
    </div>
  );
}
