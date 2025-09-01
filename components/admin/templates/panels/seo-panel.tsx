// panels/SeoPanel.tsx
'use client';

import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import * as React from 'react';

type Props = { template: Template; onChange: (patch: Partial<Template>) => void };

function getPages(t: Template) {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) return anyT.data.pages;
  if (Array.isArray(anyT?.pages)) return anyT.pages;
  return [];
}

function findHero(t: Template) {
  const pages = getPages(t);
  for (const p of pages) {
    const blocks = (p?.content_blocks || p?.blocks || []);
    const hero = (blocks || []).find((b: any) => b?.type === 'hero');
    if (hero) return hero;
  }
  return null;
}

export default function SeoPanel({ template, onChange }: Props) {
  const meta = (template?.data as any)?.meta ?? {};
  const pages = getPages(template);
  const hero = findHero(template);
  const heroContent: any = hero?.content ?? {};
  const siteTitle = String(meta?.siteTitle ?? template.template_name ?? pages[0]?.title ?? ''); // display name
  const business = String(meta?.business ?? siteTitle ?? '');

  const title = String(meta?.title ?? siteTitle ?? '');
  const description = String(meta?.description ?? heroContent?.subheadline ?? heroContent?.headline ?? '');
  const ogImage = String(meta?.ogImage ?? heroContent?.image_url ?? '');

  const setMeta = (patch: Partial<typeof meta>) => {
    onChange({
      // write canonical meta
      data: { ...(template.data as any), meta: { ...(meta ?? {}), ...patch } },
    });
  };

  const setVerified = (v: boolean) => {
    onChange({
      verified: v, // tiny mirror for back-compat, safe to keep
      data: { ...(template.data as any), meta: { ...(meta ?? {}), verified: v } },
    });
  };

  const charColor = (n: number, max: number) =>
    n <= max ? 'text-white/70' : 'text-amber-300';

  const regenFromHero = () => {
    const nextTitle = title || siteTitle || pages[0]?.title || '';
    const nextDesc =
      description || heroContent?.subheadline || heroContent?.headline || '';
    const nextImg = ogImage || heroContent?.image_url || '';
    setMeta({ title: nextTitle, description: nextDesc, ogImage: nextImg });
  };

  return (
    <Collapsible title="Verification & SEO Meta" id="verification-seo-meta">
      {/* Verified */}
      <div className="flex items-center justify-between py-2 border-t border-white/10 mt-2">
        <Label className="text-white">Verified</Label>
        <input
          type="checkbox"
          checked={Boolean(meta?.verified ?? (template as any)?.verified)}
          onChange={(e) => setVerified(e.target.checked)}
        />
      </div>

      {/* Guidance */}
      <div className="mt-3 rounded border border-white/10 bg-neutral-900/40 p-3 text-xs text-white/70 leading-relaxed">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Title</strong>: aim for ~60 characters, include your primary keyword & city if local.</li>
          <li><strong>Description</strong>: aim for ~155 characters; summarize benefits, include a call to action.</li>
          <li><strong>OG Image</strong>: 1200×630 recommended; you can pull from the hero’s main image.</li>
        </ul>
      </div>

      {/* OG Image */}
      <div className="space-y-2 mt-4">
        <Label className="text-white">OG Image URL</Label>
        <Input
          type="url"
          placeholder="https://example.com/og.jpg"
          value={ogImage}
          onChange={(e) => setMeta({ ogImage: e.target.value })}
          className="bg-gray-800 text-white border border-gray-700"
        />
        {ogImage && (
          <img
            src={ogImage}
            alt="OG Preview"
            className="mt-2 rounded border border-gray-600 w-full max-w-md"
          />
        )}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => setMeta({ ogImage: heroContent?.image_url || '' })}
            className="bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Use Hero Image
          </Button>
          <Button
            variant="outline"
            onClick={() => setMeta({ ogImage: '' })}
            className="text-sm"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <Label className="text-white">SEO Title</Label>
          <span className={`text-xs ${charColor((meta?.title ?? title).length, 60)}`}>
            {(meta?.title ?? title).length}/60
          </span>
        </div>
        <Input
          placeholder="Page Title for Search/Social (≈60 chars)"
          value={meta?.title ?? title}
          onChange={(e) => setMeta({ title: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              setMeta({ title: siteTitle || business });
            }
          }}
          className="bg-gray-800 text-white border border-gray-700"
        />
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMeta({ title: business || siteTitle })}
            className="text-sm"
          >
            Use Business Name
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMeta({ title: siteTitle || pages[0]?.title || '' })}
            className="text-sm"
          >
            Use Site Title
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <Label className="text-white">SEO Description</Label>
          <span className={`text-xs ${charColor((meta?.description ?? description).length, 155)}`}>
            {(meta?.description ?? description).length}/155
          </span>
        </div>
        <Input
          placeholder="A short description for previews (≈155 chars)"
          value={meta?.description ?? description}
          onChange={(e) => setMeta({ description: e.target.value })}
          onBlur={(e) => {
            if (!e.target.value.trim()) {
              const fallback = heroContent?.subheadline || heroContent?.headline || '';
              setMeta({ description: fallback });
            }
          }}
          className="bg-gray-800 text-white border border-gray-700"
        />
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setMeta({ description: heroContent?.subheadline || heroContent?.headline || '' })
            }
            className="text-sm"
          >
            Use Hero Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={regenFromHero}
            className="text-sm"
          >
            Regenerate from Hero
          </Button>
        </div>
      </div>
    </Collapsible>
  );
}
