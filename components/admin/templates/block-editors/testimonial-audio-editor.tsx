'use client';

// Editor for testimonial_audio: manage written reviews + paste the HJ-generated audio_url
// per review. The audio is rendered HJ-side (owner submits the quote → permanent narrator
// MP3); v1 here = paste the URL. GUARDRAIL reminder in the copy: it's read by a NARRATOR,
// never the owner/reviewer's voice.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type T = { quote: string; author: string; audio_url: string; testimonial_id: string };

const norm = (arr: any): T[] =>
  (Array.isArray(arr) ? arr : []).map((t: any) => ({
    quote: typeof t?.quote === 'string' ? t.quote : '',
    author: typeof t?.author === 'string' ? t.author : '',
    audio_url: typeof t?.audio_url === 'string' ? t.audio_url : '',
    testimonial_id: typeof t?.testimonial_id === 'string' ? t.testimonial_id : '',
  }));

export default function TestimonialAudioEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [title, setTitle] = React.useState<string>(typeof c.title === 'string' ? c.title : 'What customers say');
  const [items, setItems] = React.useState<T[]>(() => norm(c.testimonials));
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setTitle(typeof cc.title === 'string' ? cc.title : 'What customers say');
    setItems(norm(cc.testimonials));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(t: string, list: T[]) {
    return { ...(block.content as any), title: t.trim(), testimonials: list };
  }
  function apply(t: string, list: T[]) {
    setTitle(t); setItems(list);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(t, list) } as any }));
  }
  const setItem = (i: number, patch: Partial<T>) => apply(title, items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => apply(title, [...items, { quote: '', author: '', audio_url: '', testimonial_id: '' }]);
  const remove = (i: number) => apply(title, items.filter((_, idx) => idx !== i));

  if (block.type !== 'testimonial_audio') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={title} onChange={(e) => apply(e.target.value, items)} />
      </div>

      <p className="rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        Reviews are read aloud by a <b>narrator</b> — never a cloned voice. Use real customer words, copied from Google/Yelp/email. Create the audio in HiveJournal and paste the URL it returns.
      </p>

      {items.map((t, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Review {i + 1}</Label>
            <button type="button" onClick={() => remove(i)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
          </div>
          <textarea value={t.quote} onChange={(e) => setItem(i, { quote: e.target.value })} rows={2}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="The review, word-for-word" />
          <Input value={t.author} onChange={(e) => setItem(i, { author: e.target.value })} placeholder="Reviewer name (shown as text)" />
          <Input value={t.audio_url} onChange={(e) => setItem(i, { audio_url: e.target.value })} placeholder="https://…/testimonial-….mp3 (optional)" />
        </div>
      ))}

      <Button variant="secondary" onClick={add}>+ Add review</Button>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(title, items) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
