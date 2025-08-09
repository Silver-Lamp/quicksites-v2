// File: template-settings-panel/sidebar-settings.tsx
'use client';

import { useCallback, useState } from 'react';
import IdentityPanel from '../templates/panels/identity-panel';
import ServicesPanel from '../templates/panels/services-panel';
import SlugPanel from '../templates/panels/slug-panel';
import DomainPanel from '../templates/panels/domain-panel';
import SeoPanel from '../templates/panels/seo-panel';
import ThemePanel from '../templates/panels/theme-panel';
import PagesPanel from '../templates/panels/pages-panel';
import TemplateJsonEditor from '../templates/template-json-editor';
import type { Template, Page } from '@/types/template';

type Props = {
  template: Template;
  /** Accept partials to avoid clobbering state upstream */
  onChange: (patch: Partial<Template>) => void;
};

export default function SidebarSettings({ template, onChange }: Props) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  // helper so we always update canon + legacy in one go
  const applyPages = useCallback(
    (pages: Page[]) => {
      onChange({
        pages, // legacy mirror
        data: {
          ...(template.data ?? {}),
          pages, // canonical
        },
      });
    },
    [onChange, template.data]
  );

  return (
    <div
      className="space-y-4 px-4 pt-2 w-1/4 min-w-[280px] max-w-[320px] flex-shrink-0"
      id="sidebar-settings"
    >
      <PagesPanel
        template={template}
        onChange={(updated) => {
          const pages = (updated as any).pages ?? [];
          onChange({
            ...template,
            pages,
            data: { ...(template.data ?? {}), pages },
          } as Template);
        }}
        selectedIndex={selectedPageIndex}
        onSelectPage={(i) => setSelectedPageIndex(i)}
      />

      {/* The rest of the panels should emit PARTIALS only */}
      <IdentityPanel
        template={template}
        onChange={(patch) => onChange(patch)}
      />

      <ServicesPanel
        template={template}
        onChange={(patch) => onChange(patch)}
      />

      <SlugPanel
        template={template}
        onChange={(patch) => onChange(patch)}
      />

      <DomainPanel
        template={template}
        isSite={template.is_site ?? false}
        onChange={(patch) => onChange(patch)}
      />

      <SeoPanel
        template={template}
        onChange={(patch) => {
          // If your SeoPanel writes into template.meta, just forward partials:
          onChange(patch);
        }}
      />

      <ThemePanel
        template={template}
        onChange={(patch) => onChange(patch)}
      />

      {/* ⚠️ Only keep this JSON editor if you really need it in the sidebar.
          If you do, make sure it ALSO emits partials, not full template objects. */}
      
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
