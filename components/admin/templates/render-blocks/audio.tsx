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

export function isAudioFileUrl(url: string): boolean {
  return /\.(mp3|m4a|wav|ogg|oga|aac|flac)(\?[^#]*)?(#.*)?$/i.test(url.trim());
}

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
  // A direct audio FILE (the B Hard ad jingles, 2026-10-16) plays in the browser's own player:
  // visible controls, no autoplay, metadata only until pressed (audio-honesty standard — sound
  // is always the visitor's decision). Either the owner said `file`, or the URL plainly is one.
  if (content?.provider === 'file' || isAudioFileUrl(url)) {
    return (
      <div className="mb-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
        {content.title ? <div className="font-semibold">{content.title}</div> : null}
        {content.caption ? <div className="mb-2 text-sm text-muted-foreground">{content.caption}</div> : null}
        <audio controls preload="metadata" src={url} className="mt-2 w-full" title={content.title || 'Audio'} data-audio-file>
          <a href={url}>{content.title || 'Download audio'}</a>
        </audio>
      </div>
    );
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
