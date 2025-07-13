'use client';

import { templatePresets } from '@/components/admin/templates/presets/templatePresets';
import TemplatePreview from '@/components/admin/templates/template-preview';
import type { Block } from '@/types/blocks';
import type { TemplateData } from '@/types/template';

export default function PresetPreviewPage() {
  return (
    <div className="p-6 space-y-12 bg-neutral-950 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-8">Template Preset Preview</h1>

      {Object.entries(templatePresets).map(([industry, pages]) => (
        <div key={industry}>
          <h2 className="text-2xl font-semibold mb-4">{industry}</h2>
          {Object.entries(pages).map(([pageName, blocks]) => (
            <div key={pageName} className="mb-8 border border-neutral-800 rounded-xl p-6 bg-neutral-900">
              <h3 className="text-lg font-medium mb-4 capitalize">{pageName}</h3>
              <TemplatePreview
                mode="dark"
                data={
                  {
                    pages: [
                      {
                        title: pageName,
                        content_blocks: blocks as Block[],
                      },
                    ],
                  } as TemplateData
                }
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
