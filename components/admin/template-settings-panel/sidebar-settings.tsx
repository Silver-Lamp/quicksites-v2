// File: template-settings-panel/sidebar-settings.tsx

'use client';

import IdentityPanel from '../templates/panels/identity-panel';
import ServicesPanel from '../templates/panels/services-panel';
import SlugPanel from '../templates/panels/slug-panel';
import DomainPanel from '../templates/panels/domain-panel';
import SeoPanel from '../templates/panels/seo-panel';
import ThemePanel from '../templates/panels/theme-panel';
import type { Template } from '@/types/template';
import PagesPanel from '../templates/panels/pages-panel';
import { useState } from 'react';
import TemplateJsonEditor from '../templates/template-json-editor';

export default function SidebarSettings({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  return (
    <div className="space-y-4 px-4 pt-2 w-full" id="sidebar-settings">
      <PagesPanel template={template} onChange={onChange} selectedIndex={selectedPageIndex} onSelectPage={(i) => setSelectedPageIndex(i)}/>
      <IdentityPanel template={template} onChange={onChange} />
      <ServicesPanel template={template} onChange={onChange} />
      <SlugPanel template={template} onChange={onChange} />
      <DomainPanel template={template} onChange={onChange} isSite={template.is_site ?? false} />
      <SeoPanel template={template} onChange={onChange} />
      <ThemePanel template={template} onChange={onChange} />
      <TemplateJsonEditor template={template} rawJson={JSON.stringify(template.data, null, 2)} setRawJson={() => {}} sidebarValues={template.data} setSidebarValues={() => {}} colorMode={template.color_mode as 'light' | 'dark'} />
    </div>
  );
}
