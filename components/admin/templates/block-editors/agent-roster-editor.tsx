'use client';

// Editor for the Agent Roster block: heading + columns, and a managed list of agents
// (each with name/title/headshot/bio/phone/email + their own About That voice embed id).
// Add / remove / reorder agents. Mirrors listings-grid-editor's apply-patch pattern.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Agent = {
  name: string; title: string; photo_url: string; bio: string;
  phone: string; email: string; about_that_embed_id: string;
};

const BLANK: Agent = { name: '', title: '', photo_url: '', bio: '', phone: '', email: '', about_that_embed_id: '' };
const str = (v: any) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

function fromBlock(c: any) {
  const cols = Number(c?.columns);
  return {
    title: str(c?.title) || 'Meet Our Agents',
    subtitle: str(c?.subtitle),
    columns: cols >= 2 && cols <= 4 ? cols : 3,
    agents: (Array.isArray(c?.agents) ? c.agents : []).map((a: any) => ({
      ...BLANK,
      ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, str(a?.[k])])),
    })) as Agent[],
  };
}

export default function AgentRosterEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => { setLocal(fromBlock(block.content)); /* eslint-disable-next-line */ }, [block._id]);

  function toContent(n: typeof local) {
    return { ...(block.content as any), title: n.title.trim(), subtitle: n.subtitle.trim(), columns: n.columns, agents: n.agents };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }
  const setAgent = (i: number, patch: Partial<Agent>) => apply({ agents: local.agents.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const addAgent = () => apply({ agents: [...local.agents, { ...BLANK }] });
  const removeAgent = (i: number) => apply({ agents: local.agents.filter((_, idx) => idx !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= local.agents.length) return;
    const next = [...local.agents]; [next[i], next[j]] = [next[j], next[i]]; apply({ agents: next });
  };

  if (block.type !== 'agent_roster') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Section title</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Meet Our Agents" />
      </div>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <div className="grid gap-2">
          <Label>Subtitle</Label>
          <Input value={local.subtitle} onChange={(e) => apply({ subtitle: e.target.value })} placeholder="Optional line under the heading" />
        </div>
        <div className="grid gap-2">
          <Label>Columns</Label>
          <select value={local.columns} onChange={(e) => apply({ columns: Math.min(4, Math.max(2, Number(e.target.value) || 3)) })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {local.agents.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Agent {i + 1}</span>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground">↓</button>
                <button type="button" onClick={() => removeAgent(i)} className="px-1 text-muted-foreground hover:text-red-500">✕</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={a.name} onChange={(e) => setAgent(i, { name: e.target.value })} placeholder="Name" />
              <Input value={a.title} onChange={(e) => setAgent(i, { title: e.target.value })} placeholder="Title (Listing Agent)" />
            </div>
            <Input value={a.photo_url} onChange={(e) => setAgent(i, { photo_url: e.target.value })} placeholder="Headshot URL (optional — falls back to initials)" />
            <textarea
              value={a.bio}
              onChange={(e) => setAgent(i, { bio: e.target.value })}
              placeholder="Short bio"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input value={a.phone} onChange={(e) => setAgent(i, { phone: e.target.value })} placeholder="Phone (optional)" />
              <Input value={a.email} onChange={(e) => setAgent(i, { email: e.target.value })} placeholder="Email (optional)" />
            </div>
            <Input
              value={a.about_that_embed_id}
              onChange={(e) => setAgent(i, { about_that_embed_id: e.target.value })}
              placeholder="🎙️ About That voice embed id (this agent’s voice)"
            />
          </div>
        ))}
        <button type="button" onClick={addAgent} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">+ Add agent</button>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
