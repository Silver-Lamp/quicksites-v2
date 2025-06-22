// TemplatePageEditor.tsx (fixed keys)
import { Page, TemplateData } from '@/types/template';
import { BlocksEditor } from './blocks-editor';
import { SortablePage } from './sortable-page';
import { Template } from '@/types/template';
import { Block } from '@/types/blocks';

export default function TemplatePageEditor({
  template,
  onChange,
  onLivePreviewUpdate,
}: {
  template: Template;
  onChange: (template: Template) => void;
  onLivePreviewUpdate: (data: TemplateData) => void;
}) {
  const handleBlockChange = (pageIndex: number, blocks: Block[]) => {
    const updatedPages = [...template.data.pages];
    updatedPages[pageIndex].content_blocks = blocks;
    const updated = {
      ...template,
      data: { ...template.data, pages: updatedPages },
    };
    onChange(updated);
    if (onLivePreviewUpdate) onLivePreviewUpdate(updated.data);
  };

  return (
    <div className="space-y-6 pt-6">
      <h2 className="text-lg font-semibold text-white">Template Pages</h2>
      {template.data.pages.map((page: Page, index: number) => (
        <div
          key={page.id || `${page.slug}-${index}`}
          className="bg-white/5 rounded-xl p-4 shadow space-y-4"
        >
          <SortablePage page={page} />
          <BlocksEditor
            blocks={page.content_blocks ?? []}
            onChange={(blocks) => handleBlockChange(index, blocks)}
          />
        </div>
      ))}
    </div>
  );
}
