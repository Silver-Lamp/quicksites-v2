// components/admin/templates/block-editors/footer-editor.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import type { BlockEditorProps } from './index';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import { getYear } from 'date-fns';
import QuickLinksEditor from '@/components/admin/fields/quick-links-editor';
import type { Template } from '@/types/template';

type Link = { label: string; href: string };

function formatPhoneForDisplay(raw?: string | null) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 10) return raw || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function FooterEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps & { template: Template }) {
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

    // 🚫 remove legacy/nav aliases
    delete nextContent.nav_items;
    delete nextContent.navItems;

    // 🚫 DB is canonical — do not persist identity fields in block content
    delete nextContent.businessName;
    delete nextContent.phone;
    delete nextContent.address;
    delete nextContent.cityState;
    delete nextContent.street_address;
    delete nextContent.city_state;
    delete nextContent.postal;

    onSave({ ...footerBlock, content: nextContent });
  };

  const canSave = areLinksValid(content.links as Link[]);

  // ---------- DB identity fields (read-only) ----------
  const dbBusinessName = (template as any)?.business_name || '';
  const dbPhone = formatPhoneForDisplay(template?.phone);
  const dbAddress1 = (template as any)?.address_line1 || '';
  const dbAddress2 = (template as any)?.address_line2 || '';
  const dbCity = (template as any)?.city || '';
  const dbState = (template as any)?.state || '';
  const dbZip = (template as any)?.postal_code || '';

  return (
    <div className="relative flex max-h-[calc(100vh-8rem)] min-h-0 flex-col text-white">
      {/* Sticky header */}
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
          {/* LEFT: Quick Links */}
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

          {/* RIGHT: Company Info — all identity fields are read-only from DB */}
          <section className="space-y-3">
            {/* Business Name (DB) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Business Name</label>
              <input
                value={dbBusinessName || '—'}
                readOnly
                aria-readonly="true"
                className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                placeholder="Set in Template Identity"
              />
              <p className="mt-1 text-xs text-white/50">
                Read-only. Manage this in <span className="font-medium">Template Identity</span>.
              </p>
            </div>

            {/* Address (DB) */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Address</label>
                <input
                  value={dbAddress1 || '—'}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                  placeholder="Set in Template Identity"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Address 2</label>
                <input
                  value={dbAddress2 || '—'}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                  placeholder="Set in Template Identity"
                />
              </div>
            </div>

            {/* City / State / ZIP (DB) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">City</label>
                <input
                  value={dbCity || '—'}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">State</label>
                <input
                  value={dbState || '—'}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">ZIP</label>
                <input
                  value={dbZip || '—'}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                />
              </div>
            </div>

            {/* Phone (DB) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Phone</label>
              <input
                value={dbPhone || '—'}
                readOnly
                aria-readonly="true"
                className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                placeholder="Set in Template Identity"
              />
              <p className="mt-1 text-xs text-white/50">
                Read-only. Manage this in <span className="font-medium">Template Identity</span>.
              </p>
            </div>

            {/* Copyright (still editable per site) */}
            <BlockField
              type="text"
              label="Copyright"
              value={
                content.copyright ||
                `${getYear(new Date())} ${dbBusinessName}`.trim()
              }
              onChange={(v) => update('copyright', v)}
              error={fieldErrors['content.copyright']}
            />
          </section>
        </div>

        {!canSave && (
          <div className="mt-4 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-300">
            ⚠️ Please complete all required Quick Link fields before saving.
          </div>
        )}
      </div>

      {/* Sticky bottom actions */}
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
