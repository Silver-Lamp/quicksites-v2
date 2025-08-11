// components/admin/templates/tabs/general-settings-tab.tsx
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'react-hot-toast';
import type { Template, Page } from '@/types/template';

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
  handleMetaChange: (key: 'title' | 'description', value: string) => void;
};

export default function GeneralSettingsTab({ template, onChange, handleMetaChange }: Props) {
  const pages: Page[] = Array.isArray(template.data?.pages) ? template.data!.pages : [];

  const patchAllPages = (patch: Partial<Page>, successMsg: string) => {
    const updatedPages = pages.map((p) => ({ ...p, ...patch }));
    onChange({
      ...template,
      data: {
        ...(template.data ?? {}),
        pages: updatedPages,
      },
    });
    toast.success(successMsg);
  };

  const resetAllOverrides = () => {
    if (!confirm('Reset all per-page header/footer overrides?')) return;
    const resetPages = pages.map((p) => ({
      ...p,
      show_header: undefined,
      show_footer: undefined,
    }));
    onChange({
      ...template,
      data: {
        ...(template.data ?? {}),
        pages: resetPages,
      },
    });
    toast.success('Cleared all overrides (falling back to template default)');
  };

  return (
    <div className="space-y-6 pt-4">
      <div className="flex gap-4">
        <button
          onClick={() => {
            handleMetaChange('title', '');
            handleMetaChange('description', '');
          }}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
        >
          Reset Meta
        </button>
        <button
          onClick={() => toast.success('🌐 Multi-language meta coming soon')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded"
        >
          i18n Setup
        </button>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Switch
            checked={template.show_header ?? true}
            onCheckedChange={(val) => onChange({ ...template, show_header: val })}
          />
          Global Header Visibility
        </Label>
        <Label className="flex items-center gap-2">
          <Switch
            checked={template.show_footer ?? true}
            onCheckedChange={(val) => onChange({ ...template, show_footer: val })}
          />
          Global Footer Visibility
        </Label>
      </div>

      <div className="pt-6 border-t border-white/10 space-y-3">
        <h4 className="text-sm font-semibold text-white">Page Visibility Overrides</h4>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => patchAllPages({ show_header: true }, 'Applied "Show Header: true" to all pages')}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded text-white"
          >
            Apply Header: true
          </button>
          <button
            onClick={() => patchAllPages({ show_header: false }, 'Applied "Show Header: false" to all pages')}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded text-white"
          >
            Apply Header: false
          </button>
          <button
            onClick={() => patchAllPages({ show_footer: true }, 'Applied "Show Footer: true" to all pages')}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded text-white"
          >
            Apply Footer: true
          </button>
          <button
            onClick={() => patchAllPages({ show_footer: false }, 'Applied "Show Footer: false" to all pages')}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded text-white"
          >
            Apply Footer: false
          </button>
        </div>

        <button
          onClick={resetAllOverrides}
          className="mt-3 text-sm bg-yellow-700 hover:bg-yellow-600 text-white px-4 py-2 rounded"
        >
          ⟲ Reset All Page Overrides
        </button>
      </div>
    </div>
  );
}
