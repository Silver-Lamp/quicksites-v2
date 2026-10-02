'use client';

// components/admin/templates/render-blocks/audio.tsx
//
// ⚠️ AN UNCONFIGURED BLOCK RENDERS NOTHING IN PUBLIC. This emitted an empty 80px-tall <iframe>
// on a live site whenever the url was still empty — which is every one of them between being
// added from the palette and being filled in. Measured, not assumed.
//
// The hint belongs in the editor and only there: same rule as products_grid, the footer hints
// and the gallery. `isEditorContext` fails closed toward *public*, so a server render says
// nothing.

import type { Block } from '@/types/blocks';
import { isEditorContext } from '@/lib/editor/isEditorContext';

function EditorHint({ label }: { label: string }) {
  return (
    <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
      {label} Nothing shows on your live site until you add one.
    </div>
  );
}

export default function AudioBlock({
  content,
  previewOnly,
}: { content: Block['content']; previewOnly?: boolean }) {
  const url = typeof content?.url === 'string' ? content.url.trim() : '';
  if (!url) {
    return isEditorContext(previewOnly) ? <EditorHint label="Audio — paste an embed URL in this block's panel." /> : null;
  }
  return (
    <div className="mb-4">
      <iframe
        className="w-full"
        style={{ height: 80 }}
        src={url}
        title={content.title || content.provider || 'Audio'}
        allow="autoplay; encrypted-media"
        loading="lazy"
      />
    </div>
  );
}
