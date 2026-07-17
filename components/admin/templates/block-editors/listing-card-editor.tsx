'use client';

// components/admin/templates/block-editors/listing-card-editor.tsx
//
// Editor for the real-estate listing card: the listing facts (freeform display
// strings), the photo gallery (one URL per line), the inquiry CTA, and the About
// That agent-preset player slot (HiveJournal embed id — the owner-voice pitch).

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getTplId(): string {
  const t = (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
  return String(t?.id ?? '');
}

function fromBlock(c: any) {
  const s = (v: any) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
  return {
    headline: s(c?.headline),
    address: s(c?.address),
    price: s(c?.price),
    status: s(c?.status) || 'For sale',
    beds: s(c?.beds),
    baths: s(c?.baths),
    sqft: s(c?.sqft),
    description: s(c?.description),
    imagesText: Array.isArray(c?.images) ? c.images.filter(Boolean).join('\n') : '',
    cta_text: s(c?.cta_text) || 'Request a showing',
    cta_link: s(c?.cta_link) || '#contact',
    about_that_embed_id: s(c?.about_that_embed_id),
    about_that_width: s(c?.about_that_width),
  };
}

export default function ListingCardEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));

  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(next: typeof local) {
    return {
      ...(block.content as any),
      headline: next.headline.trim(),
      address: next.address.trim(),
      price: next.price.trim(),
      status: next.status.trim(),
      beds: next.beds.trim(),
      baths: next.baths.trim(),
      sqft: next.sqft.trim(),
      description: next.description,
      images: next.imagesText
        .split(/\n+/)
        .map((u: string) => u.trim())
        .filter(Boolean)
        .slice(0, 12),
      cta_text: next.cta_text.trim(),
      cta_link: next.cta_link.trim(),
      about_that_embed_id: next.about_that_embed_id.trim(),
      about_that_width: next.about_that_width.trim(),
    };
  }

  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    const patch = { op: 'update_block', blockId: block._id, content: toContent(next) };
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  }

  const embedOk = local.about_that_embed_id.trim() === '' || UUID_RX.test(local.about_that_embed_id.trim());

  // Defensive type guard runs AFTER all hooks (rules-of-hooks).
  if (block.type !== 'listing_card') return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Headline</Label>
        <Input value={local.headline} onChange={(e) => apply({ headline: e.target.value })} placeholder="Sun-filled craftsman on a quiet street" />
      </div>

      <div className="grid gap-2">
        <Label>Address</Label>
        <Input value={local.address} onChange={(e) => apply({ address: e.target.value })} placeholder="123 Maple Street, Your City, ST" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Price</Label>
          <Input value={local.price} onChange={(e) => apply({ price: e.target.value })} placeholder="$524,900" />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Input value={local.status} onChange={(e) => apply({ status: e.target.value })} placeholder="For sale / Pending / Sold" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label>Beds</Label>
          <Input value={local.beds} onChange={(e) => apply({ beds: e.target.value })} placeholder="3" />
        </div>
        <div className="grid gap-2">
          <Label>Baths</Label>
          <Input value={local.baths} onChange={(e) => apply({ baths: e.target.value })} placeholder="2.5" />
        </div>
        <div className="grid gap-2">
          <Label>Sq ft</Label>
          <Input value={local.sqft} onChange={(e) => apply({ sqft: e.target.value })} placeholder="1,850" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <textarea
          value={local.description}
          onChange={(e) => apply({ description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="What makes this home worth a look…"
        />
      </div>

      <div className="grid gap-2">
        <Label>Photos (one URL per line, first is the main shot)</Label>
        <textarea
          value={local.imagesText}
          onChange={(e) => apply({ imagesText: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder={'https://…/front.jpg\nhttps://…/kitchen.jpg'}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>CTA text</Label>
          <Input value={local.cta_text} onChange={(e) => apply({ cta_text: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label>CTA link</Label>
          <Input value={local.cta_link} onChange={(e) => apply({ cta_link: e.target.value })} placeholder="#contact" />
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>🎙️ About That player (optional)</Label>
        <p className="text-xs text-muted-foreground">
          The owner-voice pitch for this listing — paste the HiveJournal embed ID (agent preset).
        </p>
        <Input
          value={local.about_that_embed_id}
          onChange={(e) => apply({ about_that_embed_id: e.target.value })}
          placeholder="HiveJournal embed ID (uuid)"
        />
        {!embedOk && <p className="text-xs text-amber-500">That doesn't look like an embed ID (uuid) yet.</p>}
        <Input
          value={local.about_that_width}
          onChange={(e) => apply({ about_that_width: e.target.value })}
          placeholder='Player width (optional, e.g. 480 or 100%)'
        />
        {/* Yard-sign QR pack: printable assets whose QR opens the hosted listen page
            for THIS listing — buyer at the curb hears the agent talk about the house.
            Only offered with a valid embed id (renders 403 without one). */}
        {UUID_RX.test(local.about_that_embed_id.trim()) && getTplId() && (
          <a
            href={`/api/templates/${encodeURIComponent(getTplId())}/listing-qr-pack?block=${encodeURIComponent(String(block._id ?? ''))}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex w-fit items-center rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-500/20 dark:text-sky-300"
          >
            🖨 Print QR pack — yard sign, flyer, cards
          </a>
        )}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
