import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/create-default-block';
import { getContent } from '@/lib/block-utils';

type Props = {
  block: Block;
  onChange: (block: Block) => void;
  onClose: () => void;
};

const blockTypes: Block['type'][] = [
  'hero',
  'services',
  'testimonial',
  'text',
  'cta',
  'quote',
];

export default function BlockSidebar({ block, onChange, onClose }: Props) {
  const updateContent = (key: string, value: any) => {
    const updatedContent = { ...(block.content || {}), [key]: value };
    onChange({ ...block, content: updatedContent } as Block);
  };

  const inputClass =
    'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400';

  return (
    <div className="fixed right-0 top-0 h-full w-[340px] bg-zinc-900 text-white shadow-lg border-l border-zinc-800 z-50 p-4 space-y-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold capitalize">{block.type} Block</h2>
        <Button variant="ghost" onClick={onClose}>
          <X className="w-4 h-4 text-white" />
        </Button>
      </div>

      <div>
        <Label>Block Type</Label>
        <select
          value={block.type}
          onChange={(e) =>
            onChange(createDefaultBlock(e.target.value as Block['type']))
          }
          className="w-full mt-1 rounded bg-zinc-800 text-white border border-zinc-700 px-2 py-1"
        >
          {blockTypes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {block.type === 'hero' && (() => {
        const hero = getContent(block, 'hero');
        return (
          <>
            <Label>Title</Label>
            <Input className={inputClass} value={hero.title || ''} onChange={(e) => updateContent('title', e.target.value)} />
            <Label>Description</Label>
            <Input className={inputClass} value={hero.description || ''} onChange={(e) => updateContent('description', e.target.value)} />
            <Label>CTA Label</Label>
            <Input className={inputClass} value={hero.cta_label || ''} onChange={(e) => updateContent('cta_label', e.target.value)} />
            <Label>CTA Link</Label>
            <Input className={inputClass} value={hero.cta_link || ''} onChange={(e) => updateContent('cta_link', e.target.value)} />
          </>
        );
      })()}

      {block.type === 'services' && (() => {
        const services = getContent(block, 'services');
        return (
          <>
            <Label>Services (comma-separated)</Label>
            <Textarea
              className={inputClass}
              value={(services.items || []).join(', ')}
              onChange={(e) =>
                updateContent(
                  'items',
                  e.target.value.split(',').map((s) => s.trim())
                )
              }
            />
          </>
        );
      })()}

      {block.type === 'testimonial' && (() => {
        const testimonial = getContent(block, 'testimonial');
        return (
          <>
            <Label>Quote</Label>
            <Textarea className={inputClass} value={testimonial.quote || ''} onChange={(e) => updateContent('quote', e.target.value)} />
            <Label>Attribution</Label>
            <Input className={inputClass} value={testimonial.attribution || ''} onChange={(e) => updateContent('attribution', e.target.value)} />
          </>
        );
      })()}

      {block.type === 'text' && (() => {
        const text = getContent(block, 'text');
        return (
          <>
            <Label>Text</Label>
            <Textarea className={inputClass} value={text.value || ''} onChange={(e) => updateContent('value', e.target.value)} />
          </>
        );
      })()}

      {block.type === 'cta' && (() => {
        const cta = getContent(block, 'cta');
        return (
          <>
            <Label>Label</Label>
            <Input className={inputClass} value={cta.label || ''} onChange={(e) => updateContent('label', e.target.value)} />
            <Label>Link</Label>
            <Input className={inputClass} value={cta.link || ''} onChange={(e) => updateContent('link', e.target.value)} />
          </>
        );
      })()}

      {block.type === 'quote' && (() => {
        const quote = getContent(block, 'quote');
        return (
          <>
            <Label>Quote</Label>
            <Textarea className={inputClass} value={quote.text || ''} onChange={(e) => updateContent('text', e.target.value)} />
            <Label>Attribution</Label>
            <Input className={inputClass} value={quote.attribution || ''} onChange={(e) => updateContent('attribution', e.target.value)} />
          </>
        );
      })()}

      {!blockTypes.includes(block.type) && (
        <div className="text-sm text-muted-foreground">
          Unsupported block type: <code>{block.type}</code>
        </div>
      )}
    </div>
  );
}
