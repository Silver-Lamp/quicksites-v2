// BlockSidebar.tsx
// import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Block,
  HeroBlockContent,
  ServicesBlockContent,
  TestimonialBlockContent,
  TextBlockContent,
  CtaBlockContent,
  QuoteBlockContent,
  // BlockSidebarProps,
} from '@/types/blocks';

type Props = {
  block: Block;
  onChange: (block: Block) => void;
  onClose: () => void;
};

const blockTypes = ['hero', 'services', 'testimonial', 'text', 'cta', 'quote'];

export default function BlockSidebar({ block, onChange, onClose }: Props) {
  if (!block) return null;

  const updateContent = (key: string, value: any) => {
    const updatedContent = { ...(block.content || {}), [key]: value };
    onChange({ ...block, content: updatedContent });
  };

  const inputClass = 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400';

  const content = block.content || {};

  return (
    <div className="fixed right-0 top-0 h-full w-[340px] bg-zinc-900 text-white shadow-lg border-l border-zinc-800 z-50 p-4 space-y-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold capitalize">{block.type || 'Block'} Block</h2>
        <Button variant="ghost" onClick={onClose}>
          <X className="w-4 h-4 text-white" />
        </Button>
      </div>

      <div>
        <Label>Block Type</Label>
        <select
          value={block.type}
          onChange={(e) => onChange({ ...block, type: e.target.value })}
          className="w-full mt-1 rounded bg-zinc-800 text-white border border-zinc-700 px-2 py-1"
        >
          {blockTypes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {block.type === 'hero' && (
        <>
          <Label>Headline</Label>
          <Input
            className={inputClass}
            value={(content as HeroBlockContent).headline || ''}
            onChange={(e) => updateContent('headline', e.target.value)}
          />
          <Label>Subheadline</Label>
          <Input
            className={inputClass}
            value={(content as HeroBlockContent).subheadline || ''}
            onChange={(e) => updateContent('subheadline', e.target.value)}
          />
          <Label>CTA Text</Label>
          <Input
            className={inputClass}
            value={(content as HeroBlockContent).cta_text || ''}
            onChange={(e) => updateContent('cta_text', e.target.value)}
          />
          <Label>CTA Link</Label>
          <Input
            className={inputClass}
            value={(content as HeroBlockContent).cta_link || ''}
            onChange={(e) => updateContent('cta_link', e.target.value)}
          />
        </>
      )}

      {block.type === 'services' && (
        <>
          <Label>Service Items (comma-separated)</Label>
          <Textarea
            className={inputClass}
            value={(content as ServicesBlockContent).items?.join(', ') || ''}
            onChange={(e) =>
              updateContent(
                'items',
                e.target.value.split(',').map((s) => s.trim())
              )
            }
          />
        </>
      )}

      {block.type === 'testimonial' && (
        <>
          <Label>Quote</Label>
          <Textarea
            className={inputClass}
            value={(content as TestimonialBlockContent).quote || ''}
            onChange={(e) => updateContent('quote', e.target.value)}
          />
          <Label>Attribution</Label>
          <Input
            className={inputClass}
            value={(content as TestimonialBlockContent).attribution || ''}
            onChange={(e) => updateContent('attribution', e.target.value)}
          />
        </>
      )}

      {block.type === 'text' && (
        <>
          <Label>Text</Label>
          <Textarea
            className={inputClass}
            value={(content as TextBlockContent).value || ''}
            onChange={(e) => updateContent('value', e.target.value)}
          />
        </>
      )}

      {block.type === 'cta' && (
        <>
          <Label>Label</Label>
          <Input
            className={inputClass}
            value={(content as CtaBlockContent).label || ''}
            onChange={(e) => updateContent('label', e.target.value)}
          />
          <Label>Link</Label>
          <Input
            className={inputClass}
            value={(content as CtaBlockContent).link || ''}
            onChange={(e) => updateContent('link', e.target.value)}
          />
        </>
      )}

      {block.type === 'quote' && (
        <>
          <Label>Quote</Label>
          <Textarea
            className={inputClass}
            value={(content as QuoteBlockContent).text || ''}
            onChange={(e) => updateContent('text', e.target.value)}
          />
          <Label>Attribution</Label>
          <Input
            className={inputClass}
            value={(content as QuoteBlockContent).attribution || ''}
            onChange={(e) => updateContent('attribution', e.target.value)}
          />
        </>
      )}

      {!blockTypes.includes(block.type) && (
        <div className="text-sm text-muted-foreground">
          Unsupported block type: <code>{block.type}</code>
        </div>
      )}
    </div>
  );
}
