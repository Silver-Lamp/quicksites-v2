'use client';

// Profile setting: pick a decorative background for the admin work surface.
// Stored client-side (localStorage) and applied live by WorkSurfaceBackground —
// no server round-trip. See lib/ui/workBackgrounds.ts.

import * as React from 'react';
import {
  WORK_BACKGROUNDS,
  WORK_BG_CHANGED_EVENT,
  WORK_BG_ROTATE_ID,
  DEFAULT_WORK_BG_ID,
  readWorkBackgroundId,
  writeWorkBackgroundId,
} from '@/lib/ui/workBackgrounds';

export default function WorkBackgroundPicker() {
  const [selected, setSelected] = React.useState<string>('');

  React.useEffect(() => {
    setSelected(readWorkBackgroundId());
    const onChanged = (e: Event) => setSelected((e as CustomEvent<string>).detail || '');
    window.addEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
    return () => window.removeEventListener(WORK_BG_CHANGED_EVENT, onChanged as EventListener);
  }, []);

  const choose = (id: string) => {
    setSelected(id);
    writeWorkBackgroundId(id);
  };

  const options: { id: string; label: string; src?: string; rotate?: boolean }[] = [
    { id: 'none', label: 'None' },
    { id: WORK_BG_ROTATE_ID, label: 'Rotate all', rotate: true },
    ...WORK_BACKGROUNDS.map((b) => ({ id: b.id, label: b.label, src: b.src })),
  ];

  return (
    <div className="bg-zinc-800 p-4 rounded text-sm border border-zinc-700">
      <div className="text-zinc-400 mb-1">Workspace background</div>
      <p className="text-xs text-zinc-500 mb-3">
        A subtle texture behind the admin sidebar and dashboards. Doesn&apos;t affect your published sites.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((o) => {
          const active = (selected || DEFAULT_WORK_BG_ID) === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o.id)}
              className={`group relative overflow-hidden rounded-lg border text-left transition ${
                active ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-zinc-700 hover:border-zinc-500'
              }`}
              aria-pressed={active}
            >
              <div className="aspect-video w-full bg-zinc-900">
                {o.rotate ? (
                  // Rotate: a mini collage of the first backgrounds + a shuffle glyph.
                  <div className="relative grid h-full w-full grid-cols-2">
                    {WORK_BACKGROUNDS.slice(0, 4).map((b) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={b.id} src={b.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ))}
                    <div className="absolute inset-0 grid place-items-center bg-black/40 text-lg text-white">⟳</div>
                  </div>
                ) : o.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.src} alt={o.label} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">No background</div>
                )}
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="truncate text-xs text-zinc-300">{o.label}</span>
                {active && <span className="text-[10px] font-medium text-sky-300">Active</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
