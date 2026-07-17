'use client';

// Editor for the events block. Each event has a name + either a date (dated event —
// auto-hides once past) and/or a freeform "when" (recurring times like "Sundays 10am").

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type EventItem = { name: string; date: string; when: string; location: string; description: string; cta_text: string; cta_link: string };

const norm = (arr: any): EventItem[] =>
  (Array.isArray(arr) ? arr : []).map((e: any) => ({
    name: typeof e?.name === 'string' ? e.name : '',
    date: typeof e?.date === 'string' ? e.date : '',
    when: typeof e?.when === 'string' ? e.when : '',
    location: typeof e?.location === 'string' ? e.location : '',
    description: typeof e?.description === 'string' ? e.description : '',
    cta_text: typeof e?.cta_text === 'string' ? e.cta_text : '',
    cta_link: typeof e?.cta_link === 'string' ? e.cta_link : '',
  }));

export default function EventsEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [title, setTitle] = React.useState<string>(typeof c.title === 'string' ? c.title : 'Upcoming events');
  const [items, setItems] = React.useState<EventItem[]>(() => norm(c.events));
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setTitle(typeof cc.title === 'string' ? cc.title : 'Upcoming events');
    setItems(norm(cc.events));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const toContent = (t: string, list: EventItem[]) => ({ ...(block.content as any), title: t.trim(), events: list });
  function apply(t: string, list: EventItem[]) {
    setTitle(t); setItems(list);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(t, list) } as any }));
  }
  const setItem = (i: number, patch: Partial<EventItem>) => apply(title, items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => apply(title, [...items, { name: '', date: '', when: '', location: '', description: '', cta_text: '', cta_link: '' }]);
  const remove = (i: number) => apply(title, items.filter((_, idx) => idx !== i));

  if (block.type !== 'events') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={title} onChange={(e) => apply(e.target.value, items)} />
      </div>

      <p className="rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        Give a <b>date</b> for one-off events (they hide automatically after they pass), or leave it blank and use <b>“When”</b> for recurring times like “Sundays 10am”.
      </p>

      {items.map((it, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Event {i + 1}</Label>
            <button type="button" onClick={() => remove(i)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
          </div>
          <Input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Event name" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={it.date} onChange={(e) => setItem(i, { date: e.target.value })} />
            <Input value={it.when} onChange={(e) => setItem(i, { when: e.target.value })} placeholder="or “Sundays 10am”" />
          </div>
          <Input value={it.location} onChange={(e) => setItem(i, { location: e.target.value })} placeholder="Location (optional)" />
          <Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Short description (optional)" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={it.cta_text} onChange={(e) => setItem(i, { cta_text: e.target.value })} placeholder="Link text (optional)" />
            <Input value={it.cta_link} onChange={(e) => setItem(i, { cta_link: e.target.value })} placeholder="https://… (optional)" />
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={add}>+ Add event</Button>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(title, items) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
