'use client';

// Editor for the location card. Existed only as a raw JSON fallback until now, which is fine for
// an operator and useless to a restaurant owner.
//
// ⚠️ THE FIELD THAT MATTERS HERE IS "HOW TO FIND US", AND IT CAME FROM STANDING ON STREET VIEW.
// Surveying one real cohort — five no-website Renton restaurants, located by eye 2026-08-11 —
// FOUR of five are somewhere a street number does not find:
//     1222 Bronson Way N #135   → a unit in the strip with Pizza Dudes
//     2801 NE Sunset Blvd Ste b → between el Recreo and #1 Nail Pro
//     315 S 2nd St              → a counter over by M & A Barber & Beauty
//     19044 108th Ave SE        → a truck parked at the 76 station
// Every address is CORRECT and every one sends a hungry person to a building rather than to them.
// That is not a coincidence: businesses without a website are disproportionately the ones in a
// suite, a shared lot, a forecourt, or inside somebody else's shop.
//
// ⚠️ AND IT IS FREE TEXT THAT WE NEVER GENERATE. We do not know what someone sees when they pull
// up, and a guessed landmark is a wrong direction printed as fact — the same failure as an
// invented menu item, with a person driving somewhere as the consequence. The placeholder shows
// the shape; the words are the owner's.

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
    title: s(c?.title) || 'Find Us',
    business_name: s(c?.business_name),
    address: s(c?.address),
    find_us_hint: s(c?.find_us_hint),
    phone: s(c?.phone),
    email: s(c?.email),
    map_query: s(c?.map_query),
    show_map: c?.show_map !== false,
  };
}

export default function LocationEditor({ block, onSave, onClose }: Props) {
  const [local, setLocal] = React.useState(() => fromBlock(block.content));
  React.useEffect(() => {
    setLocal(fromBlock(block.content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  function toContent(next: typeof local) {
    return {
      ...(block.content as any),
      ...next,
      title: next.title.trim() || 'Find Us',
      address: next.address.trim(),
      find_us_hint: next.find_us_hint.trim(),
    };
  }
  function apply(partial: Partial<typeof local>) {
    const next = { ...local, ...partial };
    setLocal(next);
    window.dispatchEvent(
      new CustomEvent('qs:template:apply-patch', {
        detail: { op: 'update_block', blockId: block._id, content: toContent(next) } as any,
      }),
    );
  }

  if (block.type !== 'location') return null;

  // Only a nudge, and only when there is something to nudge about: a suite/unit marker in the
  // address is the strongest signal that the number alone will not find them.
  const looksHardToFind = /\b(ste|suite|unit|#)\s*\S/i.test(local.address);

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={local.title} onChange={(e) => apply({ title: e.target.value })} placeholder="Find Us" />
      </div>

      <div className="grid gap-2">
        <Label>Address</Label>
        <Input
          value={local.address}
          onChange={(e) => apply({ address: e.target.value })}
          placeholder="1222 Bronson Way N #135, Renton, WA"
        />
      </div>

      <div className="grid gap-2">
        <Label>How to find us</Label>
        <Input
          value={local.find_us_hint}
          onChange={(e) => apply({ find_us_hint: e.target.value })}
          placeholder="In the strip with Pizza Dudes — look for the red awning"
        />
        <p className="text-xs text-muted-foreground">
          What you&rsquo;d tell someone on the phone. An address finds the building; this finds
          you. Shown under the address.
        </p>
        {looksHardToFind && !local.find_us_hint && (
          <p className="text-xs text-amber-500">
            That address has a unit number — worth adding a landmark so people know what to look
            for.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Phone</Label>
          <Input value={local.phone} onChange={(e) => apply({ phone: e.target.value })} placeholder="(425) 555-0123" />
        </div>
        <div className="grid gap-2">
          <Label>Email (optional)</Label>
          <Input value={local.email} onChange={(e) => apply({ email: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Map search (optional)</Label>
        <Input
          value={local.map_query}
          onChange={(e) => apply({ map_query: e.target.value })}
          placeholder="Defaults to the address above"
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show the map</Label>
        <Switch checked={local.show_map} onCheckedChange={(v) => apply({ show_map: !!v })} />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(local) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
