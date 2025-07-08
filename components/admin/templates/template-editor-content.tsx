import TemplateSettingsPanel from './template-settings-panel';
import { TemplateEditorBranding } from './template-editor.branding';
import TemplatePageEditor from './template-page-editor';
import TemplateJsonEditor from './template-json-editor';
import TemplateHistory from './template-history';
import TemplatePreview from './template-preview';
import TemplatePublishModal from './template-publish-modal';
import DevicePreviewWrapper from './device-preview-wrapper';
import ImageUploader from '../admin/image-uploader';
import TemplateImageGallery from '../admin/template-image-gallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import TemplateActionToolbar from './template-action-toolbar';
import type { Template, TemplateData } from '@/types/template';
import { useState } from 'react';

export function TemplateEditorContent({
  template,
  rawJson,
  setRawJson,
  livePreviewData,
  setTemplate,
  autosaveStatus,
  setShowPublishModal,
}: {
  template: Template;
  rawJson: string;
  setRawJson: (v: string) => void;
  livePreviewData: TemplateData;
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  autosaveStatus: string;
  setShowPublishModal: (v: boolean) => void;
}) {
  const [showModal, setModal] = useState(false);

  return (
    <>
      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <div className="grid md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <TemplateSettingsPanel template={template} onChange={setTemplate} />
              <TemplateEditorBranding
                selectedProfileId={template.brand || ''}
                onSelectProfileId={(selectedId) =>
                  setTemplate((prev: Template) => ({ ...prev, brand: selectedId || '' }))
                }
              />
              <TemplatePageEditor
                template={template}
                onChange={setTemplate}
                onLivePreviewUpdate={(data: any) => {}}
              />
              <ImageUploader
                siteId={template.site_id || ''}
                templateId={template.id || ''}
                folder="hero"
                dbField="hero_url"
                label="Hero Image"
              />
              <TemplateImageGallery templateId={template.id || ''} />
            </div>
            <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} />
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <DevicePreviewWrapper>
            <TemplatePreview
              data={livePreviewData}
              colorScheme={template.color_scheme}
              theme={template.theme}
              brand={template.brand}
            />
          </DevicePreviewWrapper>
        </TabsContent>

        <TabsContent value="history">
          <TemplateHistory template={template} onRevert={(t) => setTemplate(t)} />
        </TabsContent>
      </Tabs>

      <TemplatePublishModal
        open={showModal}
        onClose={() => setModal(false)}
        snapshotId={template.id || ''}
      />

      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosaveStatus}
        onSaveDraft={() => {}}
      />
    </>
  );
}
