'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Pick = { enabled: boolean; config?: Record<string, any> };
type Picks = Partial<Record<
  'header' | 'hero' | 'services' | 'faq' | 'testimonial' | 'contact_form' | 'service_areas' | 'footer',
  Pick
>>;

export function BlocksPicker({
  value,
  onChange,
}: {
  value: Picks;
  onChange: (next: Picks) => void;
}) {
  const setPick = (key: keyof Picks, next: Pick) =>
    onChange({ ...value, [key]: next });

  return (
    <Card className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.header?.enabled}
            onCheckedChange={(v)=>setPick('header', { enabled: !!v })}
          />
          Header
        </Label>
      </div>

      {/* Hero */}
      <div className="space-y-2 rounded-md border border-white/10 p-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Switch
              checked={!!value.hero?.enabled}
              onCheckedChange={(v)=>setPick('hero', {
                enabled: !!v,
                config: {
                  headline: value.hero?.config?.headline || '',
                  aiCopy: value.hero?.config?.aiCopy ?? true,     // default ON
                  aiImage: value.hero?.config?.aiImage ?? false, // default OFF
                }
              })}
            />
            Hero
          </Label>

          {/* optional headline seed */}
          {!!value.hero?.enabled && (
            <Input
              className="ml-3 w-[260px]"
              placeholder="Headline"
              value={value.hero?.config?.headline || ''}
              onChange={(e)=>setPick('hero', {
                enabled: true,
                config: { ...value.hero?.config, headline: e.target.value }
              })}
            />
          )}
        </div>

        {/* AI controls (shown when hero enabled) */}
        {!!value.hero?.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
            <label className="text-xs inline-flex items-center gap-2">
              <Switch
                checked={value.hero?.config?.aiCopy ?? true}
                onCheckedChange={(v)=>setPick('hero', {
                  enabled: true,
                  config: { ...value.hero?.config, aiCopy: !!v }
                })}
              />
              Use AI to fill copy (headline/subheadline/CTA)
            </label>
            <label className="text-xs inline-flex items-center gap-2">
              <Switch
                checked={!!value.hero?.config?.aiImage}
                onCheckedChange={(v)=>setPick('hero', {
                  enabled: true,
                  config: { ...value.hero?.config, aiImage: !!v }
                })}
              />
              Generate a hero image (uploads to Storage)
            </label>
          </div>
        )}
      </div>

      {/* Services */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.services?.enabled}
            onCheckedChange={(v)=>setPick('services', {
              enabled: !!v,
              config: { columns: value.services?.config?.columns ?? 3 }
            })}
          />
          Services
        </Label>
        {!!value.services?.enabled && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Columns</span>
            <Input
              className="w-20"
              type="number"
              min={1}
              max={6}
              value={value.services?.config?.columns ?? 3}
              onChange={(e)=>setPick('services', {
                enabled: true,
                config: { ...value.services?.config, columns: Math.max(1, Math.min(6, Number(e.target.value || 3))) }
              })}
            />
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.faq?.enabled}
            onCheckedChange={(v)=>setPick('faq', { enabled: !!v })}
          />
          FAQ
        </Label>
      </div>

      {/* Testimonials */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.testimonial?.enabled}
            onCheckedChange={(v)=>setPick('testimonial', { enabled: !!v })}
          />
          Testimonials
        </Label>
      </div>

      {/* Contact Form */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.contact_form?.enabled}
            onCheckedChange={(v)=>setPick('contact_form', { enabled: !!v })}
          />
          Contact Form
        </Label>
      </div>

      {/* Service Areas */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.service_areas?.enabled}
            onCheckedChange={(v)=>setPick('service_areas', { enabled: !!v })}
          />
          Service Areas
        </Label>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Switch
            checked={!!value.footer?.enabled}
            onCheckedChange={(v)=>setPick('footer', { enabled: !!v })}
          />
          Footer
        </Label>
      </div>
    </Card>
  );
}
