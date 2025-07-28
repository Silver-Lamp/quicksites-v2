// File: panels/SeoPanel.tsx

import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
// import {  } from '@/types/blocks';

export default function SeoPanel({ template, onChange }: { template: Template; onChange: (updated: Template) => void }) {
  const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
  const businessName = template.data?.pages
    ?.flatMap((p) => p.content_blocks || [])
    .find((b) => b.type === 'footer')?.content;
  const heroBlockContent = heroBlock?.content;
  return (
    <Collapsible title="Verification & SEO Meta" id="verification-seo-meta">
      <div className="flex items-center justify-between py-2 border-t border-white/10 mt-2">
        <Label>Verified</Label>
        <input
          type="checkbox"
          checked={!!template.verified}
          onChange={(e) => onChange({ ...template, verified: e.target.checked })}
        />
      </div>

      <div className="space-y-3 mt-4">
        <div>
          <Label>OG Image URL</Label>
          <Input
            type="url"
            placeholder="https://example.com/og.jpg"
            value={template.meta?.ogImage || ''}
            onChange={(e) => onChange({ ...template, meta: { ...template.meta, ogImage: e.target.value } })}
            className="bg-gray-800 text-white border border-gray-700"
          />
          {template.meta?.ogImage && (
            <img
              src={template.meta.ogImage}
              alt="OG Preview"
              className="mt-2 rounded border border-gray-600 w-full max-w-md"
            />
          )}
          <Button
            onClick={() => {
              const ogImage = (heroBlockContent as unknown as any)?.image_url || '';
              const description = (heroBlockContent as unknown as any)?.subheadline || (heroBlockContent as unknown as any)?.headline || '';
              const title = template.template_name || template.data?.pages?.[0]?.title || '';
              onChange({
                ...template,
                meta: {
                  ...template.meta,
                  ogImage,
                  description,
                  title,
                },
              });
            }}
            className="mt-2 bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Regenerate from Hero
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Page Title for Social Media"
            value={template.meta?.title || ''}
            onChange={(e) => onChange({ ...template, meta: { ...template.meta, title: e.target.value } })}
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                const fallbackTitle = businessName || template.template_name || template.data?.pages?.[0]?.title || (heroBlockContent as unknown as any)?.headline || '';
                onChange({ ...template, meta: { ...template.meta, title: fallbackTitle } });
              }
            }}
            className="bg-gray-800 text-white border border-gray-700 flex-1"
          />
          <Button
            onClick={() => {
              if (businessName) {
                onChange({ ...template, meta: { ...template.meta, title: businessName as unknown as string } });
              }
            }}
            className="text-sm bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Use Business Name
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="A short description for previews"
            value={template.meta?.description || ''}
            onChange={(e) => onChange({ ...template, meta: { ...template.meta, description: e.target.value } })}
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                const fallbackDesc = (heroBlockContent as unknown as any)?.subheadline || (heroBlockContent as unknown as any)?.headline || '';
                onChange({ ...template, meta: { ...template.meta, description: fallbackDesc } });
              }
            }}
            className="bg-gray-800 text-white border border-gray-700 flex-1"
          />
          <Button
            onClick={() => {
              const fallbackDesc = (heroBlockContent as unknown as any)?.subheadline || (heroBlockContent as unknown as any)?.headline || '';
              onChange({ ...template, meta: { ...template.meta, description: fallbackDesc } });
            }}
            className="text-sm bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Use Hero Subheadline
          </Button>
        </div>
      </div>
    </Collapsible>
  );
}
