'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import type { BlockEditorProps } from './index';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import { getYear } from 'date-fns';
import QuickLinksEditor from '@/components/admin/fields/quick-links-editor';
import { Template } from '@/types/template';

type Link = { label: string; href: string };

export default function FooterEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps) {
  const footerBlock = block as unknown as Block;

  // 🔧 normalize incoming content so editor always sees `links`
  const initialContent = useMemo(() => {
    const c: any = footerBlock.content || {};
    const normalizedLinks: Link[] =
      (Array.isArray(c.links) && c.links.length ? c.links : null) ??
      (Array.isArray(c.nav_items) && c.nav_items.length ? c.nav_items : null) ??
      (Array.isArray(c.navItems) && c.navItems.length ? c.navItems : null) ??
      [];

    return {
      ...c,
      links: normalizedLinks.map((l: any) => ({
        label: String(l?.label ?? '').trim(),
        href: String(l?.href ?? '').trim(),
      })),
    };
  }, [footerBlock.content]);

  const [content, setContent] = useState<any>(initialContent);

  // If block prop changes underneath (e.g., live reload), refresh state
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const fieldErrors = extractFieldErrors(errors as unknown as string[]);

  const update = <K extends keyof typeof content>(key: K, value: (typeof content)[K]) =>
    setContent((prev: any) => ({ ...prev, [key]: value }));

  const areLinksValid = (links: Link[] = []) =>
    links.length === 0 || links.every((l) => l.label?.trim() && l.href?.trim());

  const handleSave = () => {
    // trim + keep only valid rows
    const cleanLinks = (content.links || [])
      .map((l: any) => ({
        label: String(l?.label ?? '').trim(),
        href: String(l?.href ?? '').trim(),
        appearance: l?.appearance,
      }))
      .filter((l: any) => l.label && l.href);
  
    const nextContent: any = {
      ...content,
      links: cleanLinks,
    };
  
    // 🚫 ensure legacy fields are removed so they can’t be re-merged server-side
    delete nextContent.nav_items;
    delete nextContent.navItems;
  
    onSave({
      ...footerBlock,
      content: nextContent,
    });
  };
  
  return (
    <div className="p-6 space-y-6 text-white">
      <h3 className="text-xl font-semibold mb-2">Edit Footer Block</h3>

      <div className="grid md:grid-cols-2 gap-8">
        {/* LEFT: Quick Links */}
        <div>
          <h4 className="text-md font-medium mb-2">Quick Links</h4>
          <QuickLinksEditor
            // ✅ pass normalized links so existing ones show up
            links={content.links as Link[]}
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
            error={fieldErrors['content.businessName']}
          />
          <BlockField
            type="text"
            label="Address"
            value={content.address}
            onChange={(v) => update('address', v)}
            error={fieldErrors['content.address']}
          />
          <BlockField
            type="text"
            label="City/State"
            value={content.cityState}
            onChange={(v) => update('cityState', v)}
            error={fieldErrors['content.cityState']}
          />
          <BlockField
            type="text"
            label="Phone"
            value={content.phone}
            onChange={(v) => update('phone', v)}
            error={fieldErrors['content.phone']}
          />
          <BlockField
            type="text"
            label="Copyright"
            value={content.copyright || `${getYear(new Date())} ${content.businessName || ''}`.trim()}
            onChange={(v) => update('copyright', v)}
            error={fieldErrors['content.copyright']}
          />
        </div>
      </div>

      {/* Inline alert for invalid links */}
      {!areLinksValid(content.links as Link[]) && (
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
          disabled={!areLinksValid(content.links as Link[])}
          title={
            !areLinksValid(content.links as Link[])
              ? 'Some links are missing label or URL'
              : ''
          }
          onClick={handleSave}
          className={`px-4 py-2 rounded font-semibold ${
            areLinksValid(content.links as Link[])
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
