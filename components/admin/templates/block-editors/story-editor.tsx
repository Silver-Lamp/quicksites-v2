// components/admin/templates/block-editors/story-editor.tsx
'use client';

import * as React from 'react';
import { useState } from 'react';
import type { BlockEditorProps } from './index';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';

type StorySection = {
  heading: string;
  body: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
};

const emptySection = (): StorySection => ({ heading: '', body: '', image_url: '', cta_text: '', cta_link: '' });

export default function StoryEditor({ block, onSave, onClose }: BlockEditorProps) {
  const b = block as unknown as Block;
  const content = (b.content as any) ?? {};
  const [title, setTitle] = useState<string>(typeof content.title === 'string' ? content.title : '');
  const [sections, setSections] = useState<StorySection[]>(
    Array.isArray(content.sections) && content.sections.length
      ? content.sections.map((s: any) => ({ ...emptySection(), ...s }))
      : [emptySection()],
  );

  const update = (i: number, key: keyof StorySection, value: string) =>
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  const move = (i: number, dir: -1 | 1) =>
    setSections((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const addSection = () => setSections((prev) => [...prev, emptySection()]);
  const removeSection = (i: number) => setSections((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const save = () => {
    // Drop blank sections; keep only those with at least a heading or body. Empty
    // cta_link is fine (schema preprocesses '' → undefined).
    const cleaned = sections
      .map((s) => ({
        heading: s.heading.trim(),
        body: s.body.trim(),
        image_url: (s.image_url || '').trim(),
        cta_text: (s.cta_text || '').trim(),
        cta_link: (s.cta_link || '').trim(),
      }))
      .filter((s) => s.heading || s.body || s.image_url);
    const finalSections = cleaned.length ? cleaned : [{ ...emptySection(), heading: 'Our Story' }];
    onSave({ ...(b as any), content: { ...(title.trim() ? { title: title.trim() } : {}), sections: finalSections } as any });
  };

  return (
    <div className="p-4 space-y-4" onKeyDownCapture={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-semibold">Edit Story Sections</h3>

      <BlockField type="text" label="Section Title (optional)" value={title} onChange={setTitle} />

      {sections.map((s, i) => (
        <div key={i} className="border border-white/10 p-3 rounded space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Section {i + 1}</span>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30" title="Move up">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="disabled:opacity-30" title="Move down">↓</button>
              {sections.length > 1 && (
                <button onClick={() => removeSection(i)} className="text-red-400 underline">Remove</button>
              )}
            </div>
          </div>

          <BlockField type="text" label="Heading" value={s.heading} onChange={(v) => update(i, 'heading', v)} />

          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Body</label>
            <textarea
              value={s.body}
              onChange={(e) => update(i, 'body', e.target.value)}
              className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm min-h-[72px]"
              placeholder="Tell this part of the story…"
            />
          </div>

          <BlockField type="text" label="Image URL" value={s.image_url || ''} onChange={(v) => update(i, 'image_url', v)} />
          {s.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image_url} alt="" className="h-20 w-20 rounded object-cover border border-white/10" />
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <BlockField type="text" label="Button text (optional)" value={s.cta_text || ''} onChange={(v) => update(i, 'cta_text', v)} />
            <BlockField type="text" label="Button link (optional)" value={s.cta_link || ''} onChange={(v) => update(i, 'cta_link', v)} />
          </div>
        </div>
      ))}

      <button onClick={addSection} className="text-sm text-green-400 underline">+ Add Section</button>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">Cancel</button>
        <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  );
}
