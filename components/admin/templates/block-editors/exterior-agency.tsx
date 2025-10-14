'use client';

import * as React from 'react';
import type { RendererProps } from '@/types/blocks';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Props = RendererProps<any>;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 items-center">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

export default function ExteriorAgencyEditor({ block, previewOnly }: Props) {
  const [local, setLocal] = React.useState<any>(block.props ?? {});
  React.useEffect(() => setLocal(block.props ?? {}), [block?.props]);

  const upd = (k: string, v: any) => setLocal((s: any) => ({ ...s, [k]: v }));

  const addItem = (k: 'services'|'packages'|'portfolio'|'testimonials') =>
    setLocal((s: any) => ({ ...s, [k]: [...(s[k] || []), {}] }));

  const removeItem = (k: string, i: number) =>
    setLocal((s: any) => ({ ...s, [k]: (s[k] || []).filter((_: any, j: number) => j !== i) }));

  // QuickSites editor usually picks up changes via onChange provided by parent.
  // If your block editor API expects a save callback, call it here.
  // @ts-ignore (editor harness usually injects onChange)
  const onChange = (block as any).onChange ?? (() => {});
  React.useEffect(() => { onChange({ ...block, props: local }); }, [local]);

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-4">
        <FieldRow label="Brand">
          <Input value={local.brand || ''} onChange={e => upd('brand', e.target.value)} />
        </FieldRow>
        <FieldRow label="Tagline">
          <Input value={local.tagline || ''} onChange={e => upd('tagline', e.target.value)} />
        </FieldRow>
        <FieldRow label="Sub-tagline">
          <Input value={local.subTagline || ''} onChange={e => upd('subTagline', e.target.value)} />
        </FieldRow>
        <FieldRow label="CTA Label">
          <Input value={local.ctaLabel || ''} onChange={e => upd('ctaLabel', e.target.value)} />
        </FieldRow>
        <FieldRow label="Phone">
          <Input value={local.phone || ''} onChange={e => upd('phone', e.target.value)} />
        </FieldRow>
        <FieldRow label="Email">
          <Input value={local.email || ''} onChange={e => upd('email', e.target.value)} />
        </FieldRow>
        <FieldRow label="Address/Area">
          <Input value={local.address || ''} onChange={e => upd('address', e.target.value)} />
        </FieldRow>
        <FieldRow label="Hero Image URL">
          <Input value={local.heroImage || ''} onChange={e => upd('heroImage', e.target.value)} />
        </FieldRow>
        <FieldRow label="Badges (comma-sep)">
          <Input
            value={(local.badges || []).join(', ')}
            onChange={e => upd('badges', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </FieldRow>
        <FieldRow label="Service Areas (comma-sep)">
          <Input
            value={(local.serviceAreas || []).join(', ')}
            onChange={e => upd('serviceAreas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </FieldRow>
        <FieldRow label="Footer Note">
          <Textarea rows={2} value={local.footerNote || ''} onChange={e => upd('footerNote', e.target.value)} />
        </FieldRow>
      </Card>

      {/* Services */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Services</div>
          <Button type="button" variant="secondary" size="sm" onClick={() => addItem('services')}>Add</Button>
        </div>
        {(local.services || []).map((s: any, i: number) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <Input className="sm:col-span-3" placeholder="Title" value={s.title || ''} onChange={e => {
              const v = e.target.value; setLocal((st: any) => {
                const arr = [...(st.services || [])]; arr[i] = { ...arr[i], title: v }; return { ...st, services: arr };
              });
            }} />
            <Input className="sm:col-span-7" placeholder="Blurb" value={s.blurb || ''} onChange={e => {
              const v = e.target.value; setLocal((st: any) => {
                const arr = [...(st.services || [])]; arr[i] = { ...arr[i], blurb: v }; return { ...st, services: arr };
              });
            }} />
            <Button className="sm:col-span-2" variant="destructive" onClick={() => removeItem('services', i)}>Remove</Button>
            <Textarea className="sm:col-span-12" rows={2}
              placeholder="Bullets (one per line)"
              value={(s.bullets || []).join('\n')}
              onChange={e => {
                const v = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean);
                setLocal((st: any) => {
                  const arr = [...(st.services || [])]; arr[i] = { ...arr[i], bullets: v }; return { ...st, services: arr };
                });
              }}
            />
          </div>
        ))}
      </Card>

      {/* Packages */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Packages</div>
          <Button type="button" variant="secondary" size="sm" onClick={() => addItem('packages')}>Add</Button>
        </div>
        {(local.packages || []).map((p: any, i: number) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <Input className="sm:col-span-3" placeholder="Name" value={p.name || ''} onChange={e => {
              const v = e.target.value; setLocal((st: any) => {
                const arr = [...(st.packages || [])]; arr[i] = { ...arr[i], name: v }; return { ...st, packages: arr };
              });
            }} />
            <Input className="sm:col-span-3" placeholder="Price (e.g., $799+ or Custom)" value={p.price || ''} onChange={e => {
              const v = e.target.value; setLocal((st: any) => {
                const arr = [...(st.packages || [])]; arr[i] = { ...arr[i], price: v }; return { ...st, packages: arr };
              });
            }} />
            <Input className="sm:col-span-4" placeholder="Description" value={p.description || ''} onChange={e => {
              const v = e.target.value; setLocal((st: any) => {
                const arr = [...(st.packages || [])]; arr[i] = { ...arr[i], description: v }; return { ...st, packages: arr };
              });
            }} />
            <Button className="sm:col-span-2" variant="destructive" onClick={() => removeItem('packages', i)}>Remove</Button>
          </div>
        ))}
      </Card>

      {/* Portfolio (before/after URLs) and Testimonials can mirror the pattern above */}
    </div>
  );
}
