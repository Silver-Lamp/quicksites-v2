// SPLIT STRATEGY:
// ────────────────────────────────
// We'll break this large file into:
// 1. TemplateSettingsPanel/index.tsx (main layout)
// 2. panels/IdentityPanel.tsx
// 3. panels/ServicesPanel.tsx
// 4. panels/SlugPanel.tsx
// 5. panels/DomainPanel.tsx
// 6. panels/SeoPanel.tsx
// 7. panels/ThemePanel.tsx

// We'll also create shared `extractBusinessName()` util for reuse.

// Starting with this initial scaffold:

// File: components/admin/template-settings-panel/index.tsx

'use client';

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { supabase } from '@/admin/lib/supabaseClient';
import type { Template } from '@/types/template';
import { useTheme } from '@/hooks/useThemeContext';
import { toast } from 'react-hot-toast';

import IdentityPanel from './panels/identity-panel';
import ServicesPanel from './panels/services-panel';
import SlugPanel from './panels/slug-panel';
import DomainPanel from './panels/domain-panel';
import SeoPanel from './panels/seo-panel';
import ThemePanel from './panels/theme-panel';

export default function TemplateSettingsPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'theme'>('general');
  const { setTheme } = useTheme();
  const isSite = template.is_site;

  useEffect(() => {
    if (!template.meta?.title || template.meta.title.trim() === '') {
      const hero = template.data.pages[0]?.content_blocks?.find(b => b.type === 'hero');
      const fallbackTitle = template.template_name || (hero?.content as unknown as any)?.headline || '';
      onChange({
        ...template,
        meta: { ...template.meta, title: fallbackTitle },
      });
    }
    if (!template.meta?.description || template.meta.description.trim() === '') {
      const hero = template.data.pages[0]?.content_blocks?.find(b => b.type === 'hero');
      const fallbackDesc = (hero?.content as unknown as any)?.subheadline || (hero?.content as unknown as any)?.headline || '';
      onChange({
        ...template,
        meta: { ...template.meta, description: fallbackDesc },
      });
    }
  }, [template]);

  return (
    <div className="rounded p-3 space-y-4">
      <div className="flex gap-2 text-sm font-medium border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={clsx('px-3 py-1 rounded', activeTab === 'general' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-300')}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={clsx('px-3 py-1 rounded', activeTab === 'theme' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-300')}
        >
          Design
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="grid md:grid-cols-2 gap-4">
          <IdentityPanel template={template} onChange={onChange} />
          <ServicesPanel template={template} onChange={onChange} />
          <SlugPanel template={template} onChange={onChange} />
          <DomainPanel template={template} onChange={onChange} isSite={isSite ?? false} />
          <SeoPanel template={template} onChange={onChange} />
        </div>
      )}

      {activeTab === 'theme' && <ThemePanel template={template} onChange={onChange} />}
    </div>
  );
}
