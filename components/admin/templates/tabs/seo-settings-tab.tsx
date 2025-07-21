import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import SeoPreviewThumbnail from '@/components/admin/seo-preview-thumbnail';
import SeoPreviewTestLinks from '@/components/admin/seo-preview-test-links';
import SeoShareCardPanel from '@/components/admin/seo-share-card-panel';
import OGBulkRebuild from '@/components/admin/og-bulk-rebuild';
import OGPreviewModal from '@/components/admin/og-preview-modal';
import type { Template } from '@/types/template';

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
  showOGPreview: boolean;
  setShowOGPreview: (open: boolean) => void;
};

const MAX_TITLE_LENGTH = 60;
const MAX_DESC_LENGTH = 160;

export default function SeoSettingsTab({ template, onChange, showOGPreview, setShowOGPreview }: Props) {
  const handleMetaChange = (key: 'title' | 'description', value: string) => {
    const meta = { ...template.meta, [key]: value };
    onChange({ ...template, meta });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>SEO Title</Label>
        <Input
          value={template.meta?.title || ''}
          onChange={(e) => handleMetaChange('title', e.target.value)}
          placeholder="e.g. Best Tow Trucks in Phoenix"
        />
        <p className={`text-xs mt-1 ${template.meta?.title?.length && template.meta.title.length > MAX_TITLE_LENGTH ? 'text-red-400' : 'text-muted-foreground'}`}>
          {template.meta?.title?.length || 0} / {MAX_TITLE_LENGTH} characters
        </p>
      </div>

      <div>
        <Label>SEO Description</Label>
        <Input
          value={template.meta?.description || ''}
          onChange={(e) => handleMetaChange('description', e.target.value)}
          placeholder="e.g. QuickSites helps you launch a towing site fast."
        />
        <p className={`text-xs mt-1 ${template.meta?.description?.length && template.meta.description.length > MAX_DESC_LENGTH ? 'text-red-400' : 'text-muted-foreground'}`}>
          {template.meta?.description?.length || 0} / {MAX_DESC_LENGTH} characters
        </p>
      </div>

      <SeoPreviewThumbnail pageUrl={template.slug} ogImageUrl={template.meta?.ogImage || ''} />
      <SeoPreviewTestLinks url={template.slug} />
      <SeoShareCardPanel url={template.slug} />

      <OGBulkRebuild
        slug={template.slug}
        endpoint="/api/og/rebuild-all"
        onResult={(results: Record<string, string>) => {
          const failures = Object.entries(results).filter(([_, result]) => result.startsWith('❌'));
          if (failures.length > 0) {
            toast.error(`OG rebuild failed on ${failures.length} page(s): ${failures.join(', ')}`);
          } else {
            toast.success('✅ All OG images rebuilt successfully');
          }
        }}
      />

      <button
        onClick={() => setShowOGPreview(true)}
        className="text-sm underline text-indigo-400 hover:text-indigo-300"
      >
        View Current OG Image
      </button>

      <OGPreviewModal
        open={showOGPreview}
        onOpenChange={setShowOGPreview}
        ogImageUrl={template.meta?.ogImage || ''}
      />
    </div>
  );
}
