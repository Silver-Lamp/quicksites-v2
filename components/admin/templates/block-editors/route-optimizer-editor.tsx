'use client';

// Editor for route_optimizer. v1 works on coord-carrying stops (lat/lon) — address→coords
// (geocoding) is the paid piece we deferred, so for now stops carry coordinates. Tip in the
// UI: right-click a spot in Google Maps to copy its lat, lon.

import * as React from 'react';
import type { Block } from '@/types/blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

type Props = { block: Block; onSave?: (b: Block) => void; onClose?: () => void };
type Pt = { label: string; latitude: string; longitude: string };

const str = (v: any) => (v == null ? '' : String(v));
const normPt = (p: any): Pt => ({ label: str(p?.label), latitude: str(p?.latitude), longitude: str(p?.longitude) });

export default function RouteOptimizerEditor({ block, onSave, onClose }: Props) {
  const c: any = block.content ?? {};
  const [title, setTitle] = React.useState(typeof c.title === 'string' ? c.title : 'Plan your route');
  const [start, setStart] = React.useState<Pt>(normPt(c.start ?? { label: 'Start' }));
  const [stops, setStops] = React.useState<Pt[]>((Array.isArray(c.stops) ? c.stops : []).map(normPt));
  const [roundTrip, setRoundTrip] = React.useState(c.round_trip === true);
  React.useEffect(() => {
    const cc: any = block.content ?? {};
    setTitle(typeof cc.title === 'string' ? cc.title : 'Plan your route');
    setStart(normPt(cc.start ?? { label: 'Start' }));
    setStops((Array.isArray(cc.stops) ? cc.stops : []).map(normPt));
    setRoundTrip(cc.round_trip === true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block._id]);

  const numOrUndef = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
  function toContent(t: string, st: Pt, list: Pt[], rt: boolean) {
    return {
      ...(block.content as any),
      title: t.trim(),
      start: { label: st.label.trim() || 'Start', latitude: numOrUndef(st.latitude), longitude: numOrUndef(st.longitude) },
      stops: list.map((p) => ({ label: p.label.trim(), latitude: numOrUndef(p.latitude), longitude: numOrUndef(p.longitude) })),
      round_trip: rt,
    };
  }
  function apply(next: { t?: string; st?: Pt; list?: Pt[]; rt?: boolean }) {
    const t = next.t ?? title, st = next.st ?? start, list = next.list ?? stops, rt = next.rt ?? roundTrip;
    setTitle(t); setStart(st); setStops(list); setRoundTrip(rt);
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { op: 'update_block', blockId: block._id, content: toContent(t, st, list, rt) } as any }));
  }
  const setStop = (i: number, patch: Partial<Pt>) => apply({ list: stops.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const addStop = () => apply({ list: [...stops, { label: '', latitude: '', longitude: '' }] });
  const removeStop = (i: number) => apply({ list: stops.filter((_, idx) => idx !== i) });

  if (block.type !== 'route_optimizer') return null;
  const ptRow = (p: Pt, on: (patch: Partial<Pt>) => void, placeholder: string) => (
    <div className="grid grid-cols-2 gap-2">
      <Input className="col-span-2" value={p.label} onChange={(e) => on({ label: e.target.value })} placeholder={placeholder} />
      <Input value={p.latitude} onChange={(e) => on({ latitude: e.target.value })} placeholder="latitude" inputMode="decimal" />
      <Input value={p.longitude} onChange={(e) => on({ longitude: e.target.value })} placeholder="longitude" inputMode="decimal" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Heading</Label>
        <Input value={title} onChange={(e) => apply({ t: e.target.value })} />
      </div>

      <p className="rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
        Enter each stop’s coordinates (right-click a spot in Google Maps → copy the lat, lon). This orders stops nearest-first and shows straight-line miles — not driving directions.
      </p>

      <div className="grid gap-2 rounded-lg border border-border p-3">
        <Label>Start</Label>
        {ptRow(start, (patch) => apply({ st: { ...start, ...patch } }), 'Start location name')}
      </div>

      {stops.map((p, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Stop {i + 1}</Label>
            <button type="button" onClick={() => removeStop(i)} className="text-xs text-muted-foreground hover:text-red-500">Remove</button>
          </div>
          {ptRow(p, (patch) => setStop(i, patch), 'Stop name (e.g. store)')}
        </div>
      ))}
      <Button variant="secondary" onClick={addStop}>+ Add stop</Button>

      <div className="flex items-center justify-between">
        <Label>Round trip (return to start)</Label>
        <Switch checked={roundTrip} onCheckedChange={(v) => apply({ rt: !!v })} />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <Button onClick={() => onSave?.({ ...block, content: toContent(title, start, stops, roundTrip) } as any)}>Save</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
