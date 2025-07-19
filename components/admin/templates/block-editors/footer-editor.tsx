'use client';

import { useState } from 'react';
import type { FooterBlock } from '@/types/blocks';
import BlockField from './block-field';
import type { BlockEditorProps } from './index';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import { getYear } from 'date-fns';
import QuickLinksEditor from '@/components/admin/fields/quick-links-editor';
import { Template } from '@/types/template';

export default function FooterEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps) {
  const footerBlock = block as FooterBlock;
  const [content, setContent] = useState(footerBlock.content);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]);

  const update = <K extends keyof typeof content>(
    key: K,
    value: typeof content[K]
  ) => setContent({ ...content, [key]: value });

  const areLinksValid = (links: { label: string; href: string }[]) =>
    links.every((link) => link.label.trim() && link.href.trim());

  return (
    <div className="p-6 space-y-6 text-white">
      <h3 className="text-xl font-semibold mb-2">Edit Footer Block</h3>

      <div className="grid md:grid-cols-2 gap-8">
        {/* LEFT: Quick Links */}
        <div>
          <h4 className="text-md font-medium mb-2">Quick Links</h4>
          <QuickLinksEditor
            links={content.links}
            onChange={(updated) => update('links', updated)}
            template={template as Template}
          />
        </div>

        {/* RIGHT: Company Info */}
        <div className="space-y-4">
          <BlockField
            type="text"
            label="Business Name"
            value={content.businessName}
            onChange={(v) => update('businessName', v)}
          />
          <BlockField
            type="text"
            label="Address"
            value={content.address}
            onChange={(v) => update('address', v)}
          />
          <BlockField
            type="text"
            label="City/State"
            value={content.cityState}
            onChange={(v) => update('cityState', v)}
          />
          <BlockField
            type="text"
            label="Phone"
            value={content.phone}
            onChange={(v) => update('phone', v)}
          />
          <BlockField
            type="text"
            label="Copyright"
            value={content.copyright || `${getYear(new Date())} ${content.businessName}`}
            onChange={(v) => update('copyright', v)}
          />
        </div>
      </div>

      {/* 🚨 Inline alert for invalid links */}
      {!areLinksValid(content.links) && (
        <div className="bg-red-900/40 text-red-300 border border-red-500 rounded p-3 text-sm">
          ⚠️ Please complete all required Quick Link fields before saving.
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-6">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded">
          Cancel
        </button>
        <button
          disabled={!areLinksValid(content.links)}
          title={
            !areLinksValid(content.links)
              ? 'Some links are missing label or URL'
              : ''
          }
          onClick={() => onSave({ ...footerBlock, content })}
          className={`px-4 py-2 rounded font-semibold ${
            areLinksValid(content.links)
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-gray-600 cursor-not-allowed'
          }`}
        >
          Save
        </button>
      </div>
    </div>
  );
}
