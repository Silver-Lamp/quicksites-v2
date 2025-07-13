'use client';

import { useState } from 'react';
import type { Block, HeroBlock } from '@/types/blocks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type Props = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

export default function HeroEditor({ block, onSave, onClose }: Props) {
  const heroBlock = block as HeroBlock;
  const [content, setContent] = useState(heroBlock.content);

  return (
    <form
      className="space-y-4 bg-white text-black dark:bg-neutral-900 dark:text-white p-4 rounded-md"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...heroBlock, content });
      }}
    >
      <div>
        <Label htmlFor="headline" className="text-sm text-gray-800 dark:text-gray-200">Headline</Label>
        <Input
          id="headline"
          placeholder="e.g. 24/7 Emergency Towing"
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          className="bg-white dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700"
        />
      </div>

      <div>
        <Label htmlFor="subheadline" className="text-sm text-gray-800 dark:text-gray-200">Subheadline</Label>
        <Input
          id="subheadline"
          placeholder="e.g. Fast, Reliable, Affordable"
          value={content.description || ''}
          onChange={(e) => setContent({ ...content, description: e.target.value })}
          className="bg-white dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700"
        />
      </div>

      <div>
        <Label htmlFor="cta_text" className="text-sm text-gray-800 dark:text-gray-200">CTA Label</Label>
        <Input
          id="cta_text"
          placeholder='e.g. "Get Help Now"'
          value={content.cta_label || ''}
          onChange={(e) => setContent({ ...content, cta_label: e.target.value })}
          className="bg-white dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700"
        />
      </div>

      <div>
        <Label htmlFor="cta_link" className="text-sm text-gray-800 dark:text-gray-200">CTA Link</Label>
        <Input
          id="cta_link"
          placeholder='e.g. /contact or tel:+15551234567'
          value={content.cta_link || ''}
          onChange={(e) => setContent({ ...content, cta_link: e.target.value })}
          className="bg-white dark:bg-neutral-800 text-black dark:text-white border-gray-300 dark:border-neutral-700"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
