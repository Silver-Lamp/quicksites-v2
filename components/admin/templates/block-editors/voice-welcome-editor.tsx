'use client';

// Editor for the voice_welcome block. The audio is rendered + owned HiveJournal-side
// (the owner writes the welcome script in the HJ dashboard, which returns a permanent
// audio_url) — so v1 here is: paste the audio_url (+ label its voice). A future
// "generate from QS" action would POST the script to the welcome endpoint, but that's
// owner-token-gated and waits on the HJ partner-auth path; pasting the URL works today.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

export default function VoiceWelcomeEditor({ block, onSave, onClose }: Props) {
  const init = React.useCallback((cc: any) => ({
    title: typeof cc.title === 'string' ? cc.title : '',
    audio_url: typeof cc.audio_url === 'string' ? cc.audio_url : '',
    embed_id: typeof cc.embed_id === 'string' ? cc.embed_id : '',
    welcome_id: typeof cc.welcome_id === 'string' ? cc.welcome_id : '',
    script: typeof cc.script === 'string' ? cc.script : '',
    voice: cc.voice === 'owner' ? 'owner' : 'narrator',
  }), []);
  const [local, setLocal] = React.useState(() => init(block.content ?? {}));
  React.useEffect(() => { setLocal(init(block.content ?? {})); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [block._id]);

  function toContent(n: typeof local) {
    return {
      ...(block.content as any),
      title: n.title.trim(),
      audio_url: n.audio_url.trim(),
      embed_id: n.embed_id.trim(),
      welcome_id: n.welcome_id.trim(),
      script: n.script.slice(0, 600),
      voice: n.voice,
    };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }

  if (block.type !== 'voice_welcome') return null;
  const urlOk = !local.audio_url || /^https:\/\//i.test(local.audio_url.trim());

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading (optional)</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Hear a quick hello" />
      </div>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>Welcome audio URL</Label>
        <Input value={local.audio_url} onChange={(e) => apply({ audio_url: e.target.value })} placeholder="https://…/welcome-….mp3" />
        {!urlOk && <p className="text-xs text-red-500">That should be an https:// audio URL.</p>}
        <p className="text-xs text-muted-foreground">
          Create your welcome in HiveJournal (Welcome audio) and paste the permanent URL it gives you. The player appears once this is set.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Whose voice is it?</Label>
        <div className="flex gap-2">
          {(['narrator', 'owner'] as const).map((v) => (
            <button key={v} type="button" onClick={() => apply({ voice: v })}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${local.voice === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
              {v === 'owner' ? 'My own voice' : 'Narrator'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Be honest: only choose “My own voice” for a welcome you recorded yourself. The narrator is a stand-in until then.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Script (reference)</Label>
        <textarea value={local.script} onChange={(e) => apply({ script: e.target.value.slice(0, 600) })} rows={3}
          maxLength={600}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="Hi, I’m … — welcome to my page." />
        <p className="text-xs text-muted-foreground">{local.script.length}/600</p>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button disabled={!urlOk} onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
