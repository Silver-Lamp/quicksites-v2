'use client';

import type { ZodError } from 'zod';

type Props = {
  error: ZodError<any> | null;
};

export default function DevValidatorPanel({ error }: Props) {
  if (!error || process.env.NODE_ENV !== 'development') return null;

  const issues = error.issues || [];

  const scrollToBlock = (blockId: string) => {
    const el = document.getElementById(`block-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring', 'ring-red-400', 'ring-offset-2');

      setTimeout(() => {
        el.classList.remove('ring', 'ring-red-400', 'ring-offset-2');
      }, 2000);
    }
  };

  return (
    <details
      open
      className="mt-4 bg-red-950 text-red-100 p-4 rounded-lg border border-red-700 text-sm open:mb-6"
    >
      <summary className="cursor-pointer font-bold">🧪 Validation Issues (Dev Only)</summary>

      {issues.length === 0 ? (
        <p className="text-green-400 mt-2">No field errors — only top-level issues.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {issues.map((issue, idx) => {
            const path = issue.path.join('.');
            const blockIndex = issue.path.findIndex((p) => p === 'content_blocks');
            const blockIdx = issue.path[blockIndex + 1];

            const isBlock = typeof blockIdx === 'number';

            return (
              <li key={idx} className="border-b border-white/10 pb-2">
                <div className="text-white font-mono mb-1">
                  <code>{path}</code>
                </div>
                <div className="text-red-300 flex gap-2 items-center justify-between">
                  <span>{issue.message}</span>
                  {isBlock && (
                    <button
                      className="text-xs underline text-blue-300"
                      onClick={() => scrollToBlock(String(blockIdx))}
                    >
                      Scroll to block #{blockIdx}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
