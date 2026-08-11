// ⚠️⚠️ DEAD. NOTHING IMPORTS THIS FILE. DO NOT ADD PANELS HERE. ⚠️⚠️
//
// The editor's settings sidebar is:
//     components/admin/template-settings-panel/sidebar-settings.tsx
//
// This file went dead around 2026-06-26 (the delivered.menu vertical removal) and has been
// collecting work ever since, because its name and contents look exactly like the live sidebar:
//
//   - 2026-07-26 (#613)  the site-backdrop PICKER was added here. It shipped as an editor feature
//                        and has never been reachable — two weeks of a built, tested, invisible UI.
//   - 2026-08-11 (#748)  the "Take it with you" download button was added here, and Sandon went
//                        looking for a button that did not exist on any page.
//
// Renamed rather than deleted so the loss stays visible. `slug-panel` is ALSO reachable only from
// here — stranded, and listed as a known orphan in the guard. (`mascot-panel` and
// `screensaver-panel` looked stranded too and are NOT: their own renderers import them. I wrote
// them into this header before checking, which is the same mistake in miniature as the one this
// file caused.)
//
// ⚠️ The guard in components/admin/__tests__/settingsPanelsMounted.test.ts now treats "imported
// only by this file" as orphaned — being referenced by a corpse is not being reachable, and the
// first version of that test counted it as a pass.

// components/admin/templates/template-settings-panel.tsx
'use client';

import * as React from 'react';
import type { Template, Page } from '@/types/template';

import IdentityPanel from './panels/identity-panel';
import ServicesPanel from './panels/services-panel';
// import SlugPanel from './panels/slug-panel';
import DomainPanel from './panels/domain-panel';
import SeoPanel from './panels/seo-panel';
import ThemePanel from './panels/theme-panel';
import BackdropPanel from './panels/backdrop-panel';
import ScreensaverPanel from './panels/screensaver-panel';
import MascotPanel from './panels/mascot-panel';
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

      {/* Sits directly under Theme — it's a visual choice and it reads the same accent. */}
      <BackdropPanel
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

      {/* <SlugPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      /> */}

      <DomainPanel
        template={template}
        isSite={template.is_site ?? false}
      />

      <SeoPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <ScreensaverPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <MascotPanel
        template={template}
        onChange={(patch: any) => applyPatch(patch)}
      />

      <PaymentSettingsPanel
        merchantId={'00001'}
        initialPlatformFeeBps={75}
      />
    </div>
  );
}
