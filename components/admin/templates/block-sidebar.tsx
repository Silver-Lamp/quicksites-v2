import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/create-default-block';
import { getContent } from '@/lib/block-utils';
import { BlockErrorDisplay } from './block-error-display';

export default function BlockSidebar({ block, onChange, onClose, errors }: { block: Block; onChange: (b: Block) => void; onClose: () => void; errors?: string[] }) {
  const updateContent = (key: string, value: any) => {
    const updatedContent = { ...(block.content || {}), [key]: value };
    onChange({ ...block, content: updatedContent } as Block);
  };

  const inputClass = 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-400';

  return (
    <div className="fixed right-0 top-0 h-full w-[340px] bg-zinc-900 text-white shadow-lg border-l border-zinc-800 z-50 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold capitalize">{block.type} Block</h2>
        <Button variant="ghost" onClick={onClose}>
          <X className="w-4 h-4 text-white" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        <div>
          <Label>Block Type</Label>
          <select
            value={block.type}
            onChange={(e) => onChange(createDefaultBlock(e.target.value as Block['type']))}
            className="w-full mt-1 rounded bg-zinc-800 text-white border border-zinc-700 px-2 py-1"
          >
            {['hero', 'services', 'testimonial', 'text', 'cta', 'quote'].map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {errors && errors.length > 0 && <BlockErrorDisplay messages={errors} />}

        {/* ...existing block type renders here (hero, services, etc) */}

        {block.type === 'cta' && (() => {
          try {
            const cta = getContent(block, 'cta');
            return (
              <>
                <Label>Label</Label>
                <Input className={inputClass} value={cta.label || ''} onChange={(e) => updateContent('label', e.target.value)} />
                <Label>Link</Label>
                <Input className={inputClass} value={cta.link || ''} onChange={(e) => updateContent('link', e.target.value)} />
              </>
            );
          } catch {
            return <div className="text-sm text-red-400">⚠ Invalid CTA block structure</div>;
          }
        })()}

        {/* Additional meta fields */}
        <div>
          <Label>Prompt</Label>
          <Textarea
            placeholder="(optional) last GPT prompt"
            className={inputClass}
            value={block.meta?.prompt || ''}
            onChange={(e) => onChange({ ...block, meta: { ...block.meta, prompt: e.target.value } })}
          />
        </div>

        <div>
          <Label>Summary</Label>
          <Textarea
            placeholder="(optional) block summary"
            className={inputClass}
            value={block.meta?.summary || ''}
            onChange={(e) => onChange({ ...block, meta: { ...block.meta, summary: e.target.value } })}
          />
        </div>

        <div>
          <Label>Comment</Label>
          <Textarea
            placeholder="(optional) editor notes or comments"
            className={inputClass}
            value={block.meta?.comment || ''}
            onChange={(e) => onChange({ ...block, meta: { ...block.meta, comment: e.target.value } })}
          />
        </div>

        <div>
          <Label>Tags</Label>
          <Input
            placeholder="e.g. ai, featured"
            className={inputClass}
            value={(block.tags || []).join(', ')}
            onChange={(e) => onChange({ ...block, tags: e.target.value.split(',').map((s) => s.trim()) })}
          />
        </div>
      </div>
    </div>
  );
}
