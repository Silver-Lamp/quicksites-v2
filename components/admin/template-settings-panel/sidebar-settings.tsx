// File: template-settings-panel/sidebar-settings.tsx
'use client';

import { useCallback, useState } from 'react';
import IdentityPanel from '../templates/panels/identity-panel';
import ServicesPanel from '../templates/panels/services-panel';
import SlugPanel from '../templates/panels/slug-panel';
import DomainPanel from '../templates/panels/domain-panel';
import SeoPanel from '../templates/panels/seo-panel';
import ThemePanel from '../templates/panels/theme-panel';
import TemplateJsonEditor from '../templates/template-json-editor';
import type { Template, Page } from '@/types/template';
import PaymentSettingsPanel from '../payments/payment-settings-panel';
import { usePersistTemplate, useTemplateRef } from '@/hooks/usePersistTemplate';

type Props = {
  template: Template;
  /** Accept partials to avoid clobbering state upstream (we'll pass full next template) */
  onChange: (patch: Partial<Template>) => void;
};

/* ---- helpers ---- */
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

  // If patch contains pages either at root or under data, mirror them to both places.
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

export default function SidebarSettings({ template, onChange }: Props) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  // Always read latest template inside async saves
  const tplRef = useTemplateRef(template);

  // Persist (debounced) to /api/templates/:id/edit
  const { persistSoon } = usePersistTemplate(
    (template as any).id,
    () => tplRef.current,
    {
      debounceMs: 350,
      onError: (e) => console.error('[sidebar persist] failed:', e),
    }
  );

  /** Apply a patch: merge → set state (parent) → persist soon */
  const applyPatch = useCallback(
    (patch: Partial<Template>) => {
      const next = mergeTemplate(tplRef.current, patch);
      onChange(next as Partial<Template>); // parent does setTemplate+onChange downstream
      persistSoon(next);
    },
    [onChange, persistSoon, tplRef]
  );

  /** Helper so we always update canon + legacy in one go */
  const applyPages = useCallback(
    (pages: Page[]) => {
      applyPatch({ pages, data: { ...(template.data ?? {}), pages } as any });
    },
    [applyPatch, template.data]
  );

  return (
    <div
      className="space-y-4 px-4 pt-2 w-1/4 min-w-[280px] max-w-[320px] flex-shrink-0"
      id="sidebar-settings"
    >
      {/* Theme updates color_mode; apply + persistSoon */}
      <ThemePanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      {/* Identity, Services, Slug, Domain all emit partials; we merge + persist */}
      <IdentityPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <ServicesPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <SlugPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <DomainPanel
        template={template}
        isSite={template.is_site ?? false}
        onChange={(patch) => applyPatch(patch)}
      />

      <SeoPanel
        template={template}
        onChange={(patch) => applyPatch(patch)}
      />

      <PaymentSettingsPanel
        siteId={template.id}
        merchantId={'00001'}
        initialPlatformFeeBps={75}
      />

      {/* Optional: JSON viewer (read-only here). If you want this to edit, wire it to applyPatch too. */}
      <TemplateJsonEditor
        rawJson={JSON.stringify(template, null, 2)}
        setRawJson={() => {}}
        sidebarValues={template}
        setSidebarValues={() => {}}
        colorMode={(template.color_mode as 'light' | 'dark') ?? 'light'}
      />
    </div>
  );
}
