'use client';

import { useState } from 'react';
import type { FooterBlock } from '@/types/blocks';
import BlockField from './block-field';
import type { BlockEditorProps } from './index'; // ✅ Reuse the shared type
import { extractFieldErrors } from '../utils/extractFieldErrors';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';

export default function FooterEditor({ block, onSave, onClose, errors = {}, template }: BlockEditorProps) {
  const footerBlock = block as FooterBlock;
  const [content, setContent] = useState(footerBlock.content);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]); // now accepts Record<string, BlockValidationError[]>

  const update = <K extends keyof typeof content>(key: K, value: typeof content[K]) =>
    setContent({ ...content, [key]: value });

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Footer Block</h3>

      <BlockField type="text" label="Business Name" value={content.businessName} onChange={(v) => update('businessName', v)} />
      <BlockField type="text" label="Address" value={content.address} onChange={(v) => update('address', v)} />
      <BlockField type="text" label="City/State" value={content.cityState} onChange={(v) => update('cityState', v)} />
      <BlockField type="text" label="Phone" value={content.phone} onChange={(v) => update('phone', v)} />

      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Quick Links</h4>
        {content.links.map((link, i) => (
          <div key={i} className="space-y-1 mb-3 border-b border-gray-700 pb-2">
            <BlockField
              type="text"
              label={`Label #${i + 1}`}
              value={link.label}
              onChange={(v) => {
                const links = [...content.links];
                links[i].label = v;
                update('links', links);
              }}
            />
            <BlockField
              type="text"
              label={`URL #${i + 1}`}
              value={link.href}
              onChange={(v) => {
                const links = [...content.links];
                links[i].href = v;
                update('links', links);
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">Cancel</button>
        <button onClick={() => onSave({ ...footerBlock, content })} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </div>
    </div>
  );
}