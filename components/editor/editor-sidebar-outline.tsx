// components/editor/EditorSidebarOutline.tsx
'use client';
import { useState } from 'react';

export function EditorSidebarOutline({ pages }: { pages: { slug: string; title: string }[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`fixed top-20 left-0 z-40 h-full bg-black/80 backdrop-blur-md text-white border-r border-white/10 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-3 border-b border-white/10 flex justify-between items-center">
        <span className="text-sm font-semibold">Outline</span>
        <button onClick={() => setOpen(false)} className="text-xs text-white/70">✖</button>
      </div>
      <ul className="p-3 text-sm space-y-2">
        {pages.map((p) => (
          <li key={p.slug}><a href={`#${p.slug}`} className="hover:underline">{p.title}</a></li>
        ))}
      </ul>
    </div>
  );
}
