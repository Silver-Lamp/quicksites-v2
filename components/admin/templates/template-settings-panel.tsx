// components/admin/templates/template-settings-panel.tsx
'use client';

import * as React from 'react';
import type { Template, Page } from '@/types/template';

import IdentityPanel from './panels/identity-panel';
import ServicesPanel from './panels/services-panel';
import SlugPanel from './panels/slug-panel';
import DomainPanel from './panels/domain-panel';
import SeoPanel from './panels/seo-panel';
import ThemePanel from './panels/theme-panel';
import PaymentSettingsPanel from '../payments/payment-settings-panel';

// ---------- helpers ----------
function getPages(t: Template): Page[] {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) return anyT.data.pages;
  if (Array.isArray(anyT?.pages)) return anyT.pages;
  return [];
}

/** Merge a patch into the current template and keep pages mirrored at both levels. */
function mergeTemplate(current: Template, patch: Partial<Template>): Template {
  const next: any = {
    ...current,
    ...patch,
    data: { ...(current as any).data, ...(patch as any).data },
  };

  // If the patch contains pages either at root or under data, mirror them to both places.
  const patchedPages =
    (patch as any)?.pages ??
    (patch as any)?.data?.pages ??
    undefined;

  if (patchedPages) {
    next.pages = patchedPages;
    next.data = { ...(next.data ?? {}), pages: patchedPages };
  } else {
    // Ensure pages remain present at both levels for UI stability
    const pages = getPages(next);
    next.pages = pages;
    next.data = { ...(next.data ?? {}), pages };
  }

  return next as Template;
}

// ---------- component ----------
type Props = {
  template: Template;
  /** Parent expects a FULL template update */
  onChange: (updated: Template) => void;
};

export default function TemplateSettingsPanel({ template, onChange }: Props) {
  // Adapter so panels that emit Partial<Template> still update the full object the parent wants
  const applyPatch = React.useCallback(
    (patch: Partial<Template>) => {
      const next = mergeTemplate(template, patch);
      onChange(next);
    },
    [template, onChange]
  );

  return (
    <div className="space-y-4 px-4 pt-2 w-1/4 min-w-[280px] max-w-[320px] flex-shrink-0" id="sidebar-settings">
      <ThemePanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <IdentityPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <ServicesPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <SlugPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <DomainPanel
        template={template}
        isSite={template.is_site ?? false}
      />

      <SeoPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <PaymentSettingsPanel
        siteId={template.id}
        merchantId={'00001'}
        initialPlatformFeeBps={75}
      />
    </div>
  );
}
