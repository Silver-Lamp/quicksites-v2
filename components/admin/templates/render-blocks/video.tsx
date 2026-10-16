'use client';

// components/admin/templates/render-blocks/video.tsx
//
// ⚠️ AN UNCONFIGURED BLOCK RENDERS NOTHING IN PUBLIC. This emitted a <video> player with controls and no source
// on a live site whenever the url was still empty — which is every one of them between being
// added from the palette and being filled in. Measured, not assumed.
//
// The hint belongs in the editor and only there: same rule as products_grid, the footer hints
// and the gallery. `isEditorContext` fails closed toward *public*, so a server render says
// nothing.
//
// Portrait + poster (2026-10-16, the B Hard commercials): a 9:16 phone commercial rendered at
// `max-w-full` is a 1,300 px tall player on a desktop, and with `preload="none"` and no poster it
// is a black rectangle until someone presses play. A portrait video now sits centred at phone
// width; a poster, when the owner gives one, is the first frame. `playsInline` so iOS does not
// take over the screen; `preload="metadata"` so the duration shows without pulling the file.

import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';

function EditorHint({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
      {label} Nothing shows on your live site until you add one.
    </div>
  );
}

export default function VideoBlock({
  content,
  previewOnly,
}: { content: Block['content']; previewOnly?: boolean }) {
  const c: any = content ?? {};
  const url = typeof c.url === 'string' ? c.url.trim() : '';
  if (!url) {
    return isEditorContext(previewOnly) ? <EditorHint label="Video — add a file or link in this block's panel." /> : null;
  }
  const poster = typeof c.poster === 'string' && /^https?:\/\//.test(c.poster.trim()) ? c.poster.trim() : undefined;
  const portrait = c.orientation === 'portrait';
  const title = typeof c.title === 'string' ? c.title.trim() : '';
  return (
    <figure className={`mb-4 ${portrait ? 'mx-auto w-full max-w-[360px]' : ''}`}>
      {title ? <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3> : null}
      <video
        controls
        playsInline
        preload={poster ? 'none' : 'metadata'}
        poster={poster}
        className={`w-full rounded-xl bg-black ${portrait ? 'aspect-[9/16] object-contain' : 'max-w-full'}`}
      >
        <source src={url} />
      </video>
      {c.caption ? <figcaption className="mt-1 text-sm text-muted-foreground">{c.caption}</figcaption> : null}
    </figure>
  );
}
