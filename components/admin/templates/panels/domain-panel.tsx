// File: panels/DomainPanel.tsx

import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DomainInstructions from '@/components/admin/domain-instructions';
import DomainStatusBadge from '@/components/admin/domain-status-badge';
import FaviconUploader from '@/components/admin/favicon-uploader';
import OGBulkRebuild from '@/components/admin/og-bulk-rebuild';
import SeoPreviewTestLinks from '@/components/admin/seo-preview-test-links';
import SeoPreviewThumbnail from '@/components/admin/seo-preview-thumbnail';
import SeoShareCardPanel from '@/components/admin/seo-share-card-panel';
import { toast } from 'react-hot-toast';
import type { Template } from '@/types/template';
import { supabase } from '@/admin/lib/supabaseClient';

export default function DomainPanel({ template, onChange, isSite }: { template: Template; onChange: (updated: Template) => void; isSite: boolean }) {
  const handleTogglePublished = async (value: boolean) => {
    const updated = { ...template, published: value };
    onChange(updated);
    const { error } = await supabase.from('templates').update({ published: value }).eq('id', template.id);
    if (error) {
      toast.error('Failed to update publish status');
      onChange({ ...template, published: !value });
    } else {
      toast.success(value ? 'Template published' : 'Template unpublished');
    }
  };

  return (
    <Collapsible title="Publishing & Domain" id="publishing-domain">
      <div className="md:col-span-2 flex justify-between items-center py-2 border-t border-white/10 mt-2">
        <Label>Status</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Publish {isSite ? 'Site' : 'Template'}</span>
          <Switch checked={!!template.published} onCheckedChange={handleTogglePublished} />
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <DomainStatusBadge domain={template.custom_domain || ''} />
        <DomainInstructions domain={template.custom_domain || ''} />
        <FaviconUploader
          templateId={template.id}
          currentUrl={template.logo_url}
          onUpload={(url) => onChange({ ...template, logo_url: url })}
        />
        <OGBulkRebuild slug={template.slug} endpoint="/api/og/rebuild-all" onResult={() => {}} />
        <SeoPreviewTestLinks url={template.slug} />
        <SeoPreviewThumbnail pageUrl={template.slug} ogImageUrl={template.meta?.ogImage || ''} />
        <SeoShareCardPanel url={template.slug} />
      </div>
    </Collapsible>
  );
}
