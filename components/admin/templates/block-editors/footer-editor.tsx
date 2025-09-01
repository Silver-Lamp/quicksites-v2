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
import { Button } from '@/components/ui/button';

type Link = { label: string; href: string };
type SocialStyle = 'icons' | 'labels' | 'both';

// ---------- utils ----------
function formatPhoneForDisplay(raw?: string | null) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 10) return raw || '';
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(v?: string | null) {
  return (v || '').replace(/\D/g, '');
}

function coalesceMeta(template?: Template) {
  const meta = (template?.data as any)?.meta ?? {};
  return {
    meta,
    contact: meta?.contact ?? {},
  };
}

function socialFromTemplate(template?: Template, content?: any) {
  const meta = (template?.data as any)?.meta ?? {};
  const social = meta?.social ?? (content?.social ?? content?.social_links) ?? {};
  // Normalize array/object into a flat object with known keys
  const obj =
    Array.isArray(social)
      ? social.reduce((acc: any, it: any) => {
          const k = String(it?.platform ?? it?.type ?? '').toLowerCase();
          if (!k) return acc;
          acc[k] = it?.url ?? it?.href ?? it?.value ?? '';
          return acc;
        }, {})
      : (social || {});
  return {
    website: String(obj.website ?? ''),
    facebook: String(obj.facebook ?? ''),
    instagram: String(obj.instagram ?? ''),
    twitter: String(obj.twitter ?? obj.x ?? ''),
    tiktok: String(obj.tiktok ?? ''),
    youtube: String(obj.youtube ?? ''),
    linkedin: String(obj.linkedin ?? ''),
    github: String(obj.github ?? ''),
    yelp: String(obj.yelp ?? ''),
    whatsapp: String(obj.whatsapp ?? ''),
    telegram: String(obj.telegram ?? ''),
    email: String(obj.email ?? (meta?.contact?.email ?? '')),
    phone: String(obj.phone ?? (meta?.contact?.phone ?? '')),
    style: (String(meta?.socialIcons ?? 'both').toLowerCase().replace('minimal', 'icons') as SocialStyle) || 'both',
  };
}

function buildSocialPatch(template: Template, socialState: ReturnType<typeof socialFromTemplate>) {
  const prevMeta = (template.data as any)?.meta ?? {};
  const prevContact = prevMeta?.contact ?? {};
  const phoneDigits = digitsOnly(socialState.phone);

  return {
    data: {
      ...(template.data as any),
      meta: {
        ...prevMeta,
        socialIcons: socialState.style,
        social: {
          website: socialState.website || '',
          facebook: socialState.facebook || '',
          instagram: socialState.instagram || '',
          twitter: socialState.twitter || '',
          x: socialState.twitter || '', // keep an alias for compatibility
          tiktok: socialState.tiktok || '',
          youtube: socialState.youtube || '',
          linkedin: socialState.linkedin || '',
          github: socialState.github || '',
          yelp: socialState.yelp || '',
          whatsapp: socialState.whatsapp || '',
          telegram: socialState.telegram || '',
          email: socialState.email || prevContact.email || '',
          phone: phoneDigits || prevContact.phone || '',
        },
      },
    },
  } as Partial<Template>;
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
  useEffect(() => setContent(initialContent), [initialContent]);

  const fieldErrors = extractFieldErrors(errors as unknown as string[]);
  const update = <K extends keyof typeof content>(key: K, value: (typeof content)[K]) =>
    setContent((prev: any) => ({ ...prev, [key]: value }));

  const areLinksValid = (links: Link[] = []) =>
    links.length === 0 || links.every((l) => l.label?.trim() && l.href?.trim());

  // ---------- Social editor state (meta-first) ----------
  const [social, setSocial] = useState(() => socialFromTemplate(template, content));
  useEffect(() => setSocial(socialFromTemplate(template, content)), [template, content]);

  const socialInputs: Array<{ key: keyof typeof social; label: string; placeholder: string; type?: 'url' | 'email' | 'tel' }> = [
    { key: 'website',   label: 'Website',   placeholder: 'mybiz.com',          type: 'url' },
    { key: 'facebook',  label: 'Facebook',  placeholder: 'facebook.com/your',  type: 'url' },
    { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/your', type: 'url' },
    { key: 'twitter',   label: 'Twitter / X', placeholder: 'x.com/your',       type: 'url' },
    { key: 'tiktok',    label: 'TikTok',    placeholder: 'tiktok.com/@your',   type: 'url' },
    { key: 'youtube',   label: 'YouTube',   placeholder: 'youtube.com/@your',  type: 'url' },
    { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'linkedin.com/company/your', type: 'url' },
    { key: 'github',    label: 'GitHub',    placeholder: 'github.com/your',    type: 'url' },
    { key: 'yelp',      label: 'Yelp',      placeholder: 'yelp.com/biz/your',  type: 'url' },
    { key: 'whatsapp',  label: 'WhatsApp',  placeholder: 'wa.me/15551234567',  type: 'url' },
    { key: 'telegram',  label: 'Telegram',  placeholder: 't.me/your',          type: 'url' },
    { key: 'email',     label: 'Email',     placeholder: 'hello@your.com',     type: 'email' },
    { key: 'phone',     label: 'Phone',     placeholder: '(555) 123-4567',     type: 'tel' },
  ];

  const applySocialToTemplate = () => {
    const patch = buildSocialPatch(template, social);
    // Use the global patch bus — EditorContent listens and autosaves via commit
    try {
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
    } catch {}
  };

  // ---------- DB identity fields (read-only) — now meta-first ----------
  const { meta, contact } = coalesceMeta(template);
  const dbBusinessName = String(meta?.business ?? meta?.siteTitle ?? '') || '—';
  const dbPhone = formatPhoneForDisplay(contact?.phone);
  const dbAddress1 = String(contact?.address ?? '') || '—';
  const dbAddress2 = String(contact?.address2 ?? '') || '';
  const dbCity = String(contact?.city ?? '') || '—';
  const dbState = String(contact?.state ?? '') || '—';
  const dbZip = String(contact?.postal ?? '') || '—';

  // ---------- Save footer block (links + copyright) ----------
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

    // 🚫 DB/meta is canonical — do not persist identity in block
    delete nextContent.businessName;
    delete nextContent.phone;
    delete nextContent.address;
    delete nextContent.cityState;
    delete nextContent.street_address;
    delete nextContent.city_state;
    delete nextContent.postal;
    delete nextContent.social;       // socials are meta-first now
    delete nextContent.social_links; // legacy alias

    onSave({ ...footerBlock, content: nextContent });
  };

  const canSave = areLinksValid(content.links as Link[]);

  return (
    <div className="relative flex max-h-[calc(100vh-8rem)] min-h-0 flex-col text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-900/70 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Edit Footer Block</h3>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!canSave} title={!canSave ? 'Some links are missing label or URL' : ''}>
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* LEFT: Quick Links (block content) */}
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

            {/* Copyright (block content) */}
            <div className="mt-4">
              <BlockField
                type="text"
                label="Copyright"
                value={content.copyright || `${getYear(new Date())} ${dbBusinessName}`.trim()}
                onChange={(v) => update('copyright', v)}
                error={fieldErrors['content.copyright']}
              />
            </div>
          </section>

          {/* RIGHT: Company & Social (meta-first) */}
          <section className="space-y-4">
            {/* Company Info — read-only, edited in Template Identity */}
            <div className="space-y-3 rounded-lg border border-white/10 p-3">
              <h4 className="text-sm font-medium text-white/80">Company Info (read-only)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/70">Business</label>
                  <input
                    value={dbBusinessName}
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                    placeholder="Set in Template Identity"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/70">Phone</label>
                  <input
                    value={dbPhone || '—'}
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/70">Address</label>
                  <input
                    value={dbAddress1}
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={dbAddress2} readOnly aria-readonly="true" className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90" placeholder="Address 2" />
                  <input value={dbCity} readOnly aria-readonly="true" className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90" placeholder="City" />
                  <input value={dbState} readOnly aria-readonly="true" className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90" placeholder="State" />
                  <input value={dbZip} readOnly aria-readonly="true" className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90" placeholder="ZIP" />
                </div>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Manage identity in <span className="font-medium">Template Identity</span>.
              </p>
            </div>

            {/* Social Links — writes into data.meta.social (site-wide) */}
            <div className="space-y-3 rounded-lg border border-white/10 p-3">
              <h4 className="text-sm font-medium text-white/80">Follow Us (Social)</h4>

              {/* style selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div className="sm:col-span-2 text-xs text-white/60">
                  Controls which elements render for each social item in the footer.
                </div>
                <div>
                  <label className="mb-1 block text-xs text-white/70">Style</label>
                  <select
                    value={social.style}
                    onChange={(e) =>
                      setSocial((s) => ({ ...s, style: e.target.value as SocialStyle }))
                    }
                    className="w-full rounded border border-white/10 bg-neutral-800 px-2 py-1 text-sm"
                  >
                    <option value="both">Icon + Label</option>
                    <option value="icons">Icon Only</option>
                    <option value="labels">Label Only</option>
                  </select>
                </div>
              </div>

              {/* inputs grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {socialInputs.map((f) => (
                  <div key={String(f.key)}>
                    <label className="mb-1 block text-xs text-white/70">{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      value={social[f.key] as string}
                      onChange={(e) =>
                        setSocial((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      placeholder={f.placeholder}
                      className="w-full rounded border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white/90"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" onClick={() => setSocial(socialFromTemplate(template, content))}>
                  Reset
                </Button>
                <Button onClick={applySocialToTemplate}>Apply Social</Button>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Social links are saved site-wide into <code>data.meta.social</code>.
              </p>
            </div>
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} title={!canSave ? 'Some links are missing label or URL' : ''}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
