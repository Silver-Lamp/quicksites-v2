'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type EAProps = {
  brand?: string;
  tagline?: string;
  subTagline?: string;
  ctaLabel?: string;
  phone?: string;
  email?: string;
  address?: string;
  heroImage?: string;
  badges?: string[];
  serviceAreas?: string[];
  services?: Array<{ title?: string; blurb?: string; bullets?: string[] }>;
  packages?: Array<{ name?: string; price?: string; description?: string; featured?: boolean }>;
  portfolio?: Array<{ title?: string; subtitle?: string; before?: string; after?: string }>;
  testimonials?: Array<{ quote?: string; author?: string; role?: string }>;
  footerNote?: string;
};

function Section({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Row({ label, children }: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
      <div className="text-xs sm:text-sm text-muted-foreground">{label}</div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export default function ExteriorAgencyEditor({ block, onSave, onClose }: BlockEditorProps) {
  const [local, setLocal] = React.useState<EAProps>((block.props as any) ?? {});
  React.useEffect(() => setLocal((block.props as any) ?? {}), [block]);

  const upd = (k: keyof EAProps, v: any) =>
    setLocal((s) => ({ ...(s || {}), [k]: v }));

  const parseCsv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const save = React.useCallback(() => {
    const updated: Block = { ...block, props: local as any };
    onSave(updated);
  }, [block, local, onSave]);

  /* ---------- list helpers ---------- */
  const setListItem = <T extends object>(
    key: keyof EAProps,
    i: number,
    patch: Partial<T>
  ) =>
    setLocal((s) => {
      const arr = ([...(s?.[key] as any[] ?? [])]) as T[];
      arr[i] = { ...(arr[i] ?? {}), ...patch } as T;
      return { ...(s || {}), [key]: arr } as EAProps;
    });

  const addToList = (key: keyof EAProps, item: any) =>
    setLocal((s) => ({ ...(s || {}), [key]: [ ...(s?.[key] as any[] ?? []), item ] }));

  const removeFromList = (key: keyof EAProps, idx: number) =>
    setLocal((s) => {
      const arr = ([...(s?.[key] as any[] ?? [])]);
      arr.splice(idx, 1);
      return { ...(s || {}), [key]: arr } as EAProps;
    });

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={save}>Apply</Button>
      </div>

      {/* Basics */}
      <Section title="Basics">
        <Row label="Brand">
          <Input value={local.brand ?? ''} onChange={(e) => upd('brand', e.target.value)} />
        </Row>
        <Row label="Tagline">
          <Input value={local.tagline ?? ''} onChange={(e) => upd('tagline', e.target.value)} />
        </Row>
        <Row label="Sub-tagline">
          <Input value={local.subTagline ?? ''} onChange={(e) => upd('subTagline', e.target.value)} />
        </Row>
        <Row label="CTA Label">
          <Input value={local.ctaLabel ?? 'Get a Free Quote'} onChange={(e) => upd('ctaLabel', e.target.value)} />
        </Row>
        <Row label="Phone">
          <Input value={local.phone ?? ''} onChange={(e) => upd('phone', e.target.value)} />
        </Row>
        <Row label="Email">
          <Input value={local.email ?? ''} onChange={(e) => upd('email', e.target.value)} />
        </Row>
        <Row label="Service Area / Address">
          <Input value={local.address ?? ''} onChange={(e) => upd('address', e.target.value)} />
        </Row>
        <Row label="Hero Image URL">
          <Input value={local.heroImage ?? ''} onChange={(e) => upd('heroImage', e.target.value)} />
        </Row>
        <Row label="Badges (comma-sep)">
          <Input
            value={(local.badges ?? []).join(', ')}
            onChange={(e) => upd('badges', parseCsv(e.target.value))}
          />
        </Row>
        <Row label="Service Areas (comma-sep)">
          <Input
            value={(local.serviceAreas ?? []).join(', ')}
            onChange={(e) => upd('serviceAreas', parseCsv(e.target.value))}
          />
        </Row>
        <Row label="Footer Note">
          <Textarea rows={2} value={local.footerNote ?? ''} onChange={(e) => upd('footerNote', e.target.value)} />
        </Row>
      </Section>

      {/* Services */}
      <Section title="Services">
        <div className="space-y-3">
          {(local.services ?? []).map((s, i) => (
            <Card key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Service #{i + 1}</div>
                <Button variant="destructive" size="sm" onClick={() => removeFromList('services', i)}>
                  Remove
                </Button>
              </div>
              <Input placeholder="Title" value={s?.title ?? ''} onChange={(e) => setListItem('services', i, { title: e.target.value })} />
              <Input placeholder="Blurb" value={s?.blurb ?? ''} onChange={(e) => setListItem('services', i, { blurb: e.target.value })} />
              <Textarea
                rows={2}
                placeholder="Bullets (one per line)"
                value={(s?.bullets ?? []).join('\n')}
                onChange={(e) => setListItem('services', i, { bullets: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })}
              />
            </Card>
          ))}
          <Button variant="secondary" size="sm" onClick={() => addToList('services', { title: '', blurb: '', bullets: [] })}>
            Add service
          </Button>
        </div>
      </Section>

      {/* Packages */}
      <Section title="Packages">
        <div className="space-y-3">
          {(local.packages ?? []).map((p, i) => (
            <Card key={i} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Package #{i + 1}</div>
                <Button variant="destructive" size="sm" onClick={() => removeFromList('packages', i)}>
                  Remove
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input className="sm:col-span-1" placeholder="Name" value={p?.name ?? ''} onChange={(e) => setListItem('packages', i, { name: e.target.value })} />
                <Input className="sm:col-span-1" placeholder="Price (e.g., $799+ or Custom)" value={p?.price ?? ''} onChange={(e) => setListItem('packages', i, { price: e.target.value })} />
                <Input className="sm:col-span-1" placeholder="Description" value={p?.description ?? ''} onChange={(e) => setListItem('packages', i, { description: e.target.value })} />
              </div>
            </Card>
          ))}
          <Button variant="secondary" size="sm" onClick={() => addToList('packages', { name: '', price: '', description: '' })}>
            Add package
          </Button>
        </div>
      </Section>

      {/* (Optional) Portfolio & Testimonials – add later if you want; same pattern */}

      {/* Actions bottom */}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={save}>Apply</Button>
      </div>
    </div>
  );
}
