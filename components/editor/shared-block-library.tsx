// components/editor/SharedBlockLibrary.tsx
'use client';
import { useEffect, useState } from 'react';

const MOCK_LIBRARY = [
  {
    id: 'preset-hero',
    type: 'hero',
    content: {
      headline: 'We Help You Win',
      subheadline: 'AI-powered results in minutes.',
    },
  },
  {
    id: 'preset-cta',
    type: 'cta',
    content: {
      label: 'Get Started',
      link: '/signup',
    },
  },
];

export function SharedBlockLibrary({ onInsert }: { onInsert: (block: any) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-20 right-6 z-40 text-white text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded"
      >
        {open ? 'Close Library' : '📚 Block Library'}
      </button>
      {open && (
        <div className="mt-2 p-3 border border-white/10 bg-neutral-900 rounded shadow-lg w-72 space-y-3">
          {MOCK_LIBRARY.map((block) => (
            <div
              key={block.id}
              className="p-2 border border-white/10 rounded hover:bg-white/10 cursor-pointer"
              onClick={() => {
                onInsert({ ...block, _id: crypto.randomUUID() });
                setOpen(false);
              }}
            >
              <strong>{block.type}</strong>
              <pre className="text-xs">{JSON.stringify(block.content, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
