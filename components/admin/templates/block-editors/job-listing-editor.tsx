'use client';

// Editor for the job/gig listing. General gig or an AisleAsk store-cataloging gig
// (deliverable = ordered_sections, which turns the applicant form into a walk-order
// input). recipient_email is where applications go; submit_url is the optional
// structured auto-ingest endpoint (e.g. HJ's aisleask catalog token).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

function fromBlock(c: any) {
  const s = (v: any) => (typeof v === 'string' ? v : '');
  return {
    catalog: c?.deliverable === 'ordered_sections',
    title: s(c?.title),
    store_name: s(c?.store_name),
    location: s(c?.location),
    pay: s(c?.pay),
    instructions: s(c?.instructions),
    recipient_email: s(c?.recipient_email),
    submit_url: s(c?.submit_url),
    permission_confirmed: c?.permission_confirmed === true,
  };
}

export default function JobListingEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(n: typeof local) {
    return {
      ...(block.content as any),
      kind: n.catalog ? 'aisleask_catalog' : 'general',
      deliverable: n.catalog ? 'ordered_sections' : 'message',
      title: n.title.trim(),
      store_name: n.store_name.trim(),
      location: n.location.trim(),
      pay: n.pay.trim(),
      instructions: n.instructions,
      recipient_email: n.recipient_email.trim(),
      submit_url: n.submit_url.trim(),
      permission_confirmed: n.permission_confirmed,
    };
  }
  function apply(partial: Partial<typeof local>) {
    const n = { ...local, ...partial };
    setLocal(n);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(n) } as any }));
  }

  if (block.type !== 'job_listing') return null;
  const emailOk = local.recipient_email.trim() === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(local.recipient_email.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label>AisleAsk store-cataloging gig</Label>
          <p className="text-xs text-muted-foreground">Turns the form into a walk-order (ordered sections) submission.</p>
        </div>
        <Switch checked={local.catalog} onCheckedChange={(v) => apply({ catalog: !!v })} />
      </div>

      {local.catalog ? (
        <div className="grid gap-2">
          <Label>Store name</Label>
          <Input value={local.store_name} onChange={(e) => apply({ store_name: e.target.value })} placeholder="Safeway — Elm St" />
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>Gig title</Label>
          <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Help wanted — one-time gig" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Location / address</Label>
          <Input value={local.location} onChange={(e) => apply({ location: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>Pay (stated up front)</Label>
          <Input value={local.pay} onChange={(e) => apply({ pay: e.target.value })} placeholder="$25, one-time" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Instructions</Label>
        <textarea value={local.instructions} onChange={(e) => apply({ instructions: e.target.value })} rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      <div className="grid gap-2">
        <Label>Applications go to (email)</Label>
        <Input value={local.recipient_email} onChange={(e) => apply({ recipient_email: e.target.value })} placeholder="you@example.com" />
        {!emailOk && <p className="text-xs text-amber-500">That doesn't look like an email.</p>}
      </div>

      {local.catalog && (
        <>
          <div className="grid gap-2">
            <Label>Auto-ingest endpoint (optional)</Label>
            <Input value={local.submit_url} onChange={(e) => apply({ submit_url: e.target.value })} placeholder="HiveJournal catalog token URL (https://…)" />
            <p className="text-xs text-muted-foreground">When set, the submitted walk order also POSTs here for auto-ingest.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div>
              <Label>This store has given permission to catalog</Label>
              <p className="text-xs text-muted-foreground">Required — never post a cataloging gig for a store that hasn't opted in.</p>
            </div>
            <Switch checked={local.permission_confirmed} onCheckedChange={(v) => apply({ permission_confirmed: !!v })} />
          </div>
        </>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
