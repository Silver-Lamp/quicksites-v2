// components/admin/templates/block-editors/footer-editor.tsx
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

    const nextContent: any = { ...content, links: cleanLinks };
    // 🚫 remove legacy fields so they don’t resurrect server-side
    delete nextContent.nav_items;
    delete nextContent.navItems;

    onSave({ ...footerBlock, content: nextContent });
  };

  const canSave = areLinksValid(content.links as Link[]);

  return (
    /**
     * Make THIS element the scroll container.
     * - max-h keeps it inside the viewport
     * - flex/min-h-0 ensure the inner overflow works even inside flex parents
     */
    <div className="relative flex max-h-[calc(100vh-8rem)] min-h-0 flex-col text-white">

      {/* Sticky header with actions so you never have to zoom/scroll to find Save */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Edit Footer Block</h3>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              title={!canSave ? 'Some links are missing label or URL' : ''}
              className={`px-3 py-2 rounded font-semibold ${
                canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Quick Links (own scroll to keep page compact) */}
          <section>
            <h4 className="mb-2 text-sm font-medium text-white/80">Quick Links</h4>
            <div className="rounded-lg border border-white/10">
              <div className="max-h-[60vh] overflow-y-auto p-3 pr-4">
                <QuickLinksEditor
                  links={content.links as Link[]}
                  onChange={(updated) => update('links', updated)}
                  template={template as Template}
                />
              </div>
            </div>
          </section>

          {/* RIGHT: Company Info — denser spacing */}
          <section className="space-y-3">
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
              value={
                content.copyright ||
                `${getYear(new Date())} ${content.businessName || ''}`.trim()
              }
              onChange={(v) => update('copyright', v)}
              error={fieldErrors['content.copyright']}
            />
          </section>
        </div>

        {/* Inline alert for invalid links */}
        {!canSave && (
          <div className="mt-4 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-300">
            ⚠️ Please complete all required Quick Link fields before saving.
          </div>
        )}
      </div>

      {/* Sticky bottom actions (nice on long forms; duplicates top for ergonomics) */}
      <div className="sticky bottom-0 z-20 border-t border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-3">
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            title={!canSave ? 'Some links are missing label or URL' : ''}
            className={`px-3 py-2 rounded font-semibold ${
              canSave ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
