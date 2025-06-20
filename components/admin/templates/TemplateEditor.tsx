// TemplateEditor.tsx (with logging + fallback JSON)
import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TemplateSettingsPanel from './TemplateSettingsPanel';
import TemplatePageEditor from './TemplatePageEditor';
import TemplateJsonEditor from './TemplateJsonEditor';
import TemplateHistory from './TemplateHistory';
import TemplatePreview from './TemplatePreview';
import TemplateActionToolbar from './TemplateActionToolbar';
import TemplatePublishModal from './TemplatePublishModal';
import DevicePreviewWrapper from './DevicePreviewWrapper';
import { useAutosaveTemplate } from '@/hooks/useAutosaveTemplate';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import ImageUploader from '../admin/ImageUploader';
import TemplateImageGallery from '../admin/TemplateImageGallery';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { TemplateData } from '@/types/template';

export default function TemplateEditor({ templateName }: { templateName: string }) {
  const [template, setTemplate] = useState<Template>({
    name: templateName,
    layout: 'default',
    color_scheme: '',
    commit: '',
    industry: '',
    theme: '',
    brand: '',
    data: { pages: [] },
  });

  const [rawJson, setRawJson] = useState('');
  const [livePreviewData, setLivePreviewData] = useState({});
  const [showPublishModal, setShowPublishModal] = useState(false);
  const autosave = useAutosaveTemplate(template, rawJson);

  const sampleBlocks: Block[] = [
    {
      type: 'text',
      content: {
        text: 'Welcome to the playground! This is a simple text block.',
      },
    },
    {
      type: 'image',
      content: {
        url: 'https://placekitten.com/800/400',
        alt: 'A cute kitten',
      },
    },
    {
      type: 'video',
      content: {
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        caption: 'Example video',
      },
    },
    {
      type: 'audio',
      content: {
        provider: 'soundcloud',
        url: 'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293',
        title: 'Sound demo',
      },
    },
    {
      type: 'quote',
      content: {
        text: 'The best way to predict the future is to invent it.',
        author: 'Alan Kay',
      },
    },
    {
      type: 'button',
      content: {
        label: 'Click Me',
        href: 'https://example.com',
        style: 'primary',
      },
    },
    {
      type: 'grid',
      content: {
        columns: 2,
        items: [
          { type: 'text', content: { text: 'Left column text block' } },
          {
            type: 'image',
            value: { url: 'https://placebear.com/400/200', alt: 'A bear' },
          },
        ],
      },
    },
  ];

  useEffect(() => {
    fetch(`/api/templates/${templateName}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('Fetched template data:', data);
        const fallback = {
          pages: [
            {
              id: 'index',
              slug: 'index',
              title: 'Sample Page',
              content_blocks: sampleBlocks,
            },
          ],
        };
        const finalData = data?.data && Object.keys(data.data).length > 0 ? data.data : fallback;
        const normalized = normalizeTemplate({ ...data, data: finalData });
        setTemplate(normalized);
        setRawJson(JSON.stringify(finalData, null, 2));
        setLivePreviewData(finalData);
      });
  }, [templateName]);

  useEffect(() => {
    setRawJson(JSON.stringify(template.data, null, 2));
  }, [template.data]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(rawJson);
      setLivePreviewData(parsed);
      setTemplate((prev) => ({ ...prev, data: parsed }));
    } catch {
      // Ignore
    }
  }, [rawJson]);

  const handleSaveDraft = () => {
    localStorage.setItem(`draft-${template.id}`, rawJson);
    toast.success('Draft saved manually');
  };

  return (
    <ScrollArea className="h-screen w-full">
      <div className="p-6 space-y-6 pb-40">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{template?.name}</h1>
          <Button onClick={() => setShowPublishModal(true)}>Publish Site</Button>
        </div>

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
                <TemplatePageEditor
                  template={template}
                  onChange={setTemplate}
                  onLivePreviewUpdate={(data: any) => setLivePreviewData(data)}
                />
                <div className="mt-6 p-4 rounded text-sm bg-gray-800 text-white">
                  <p className="font-bold">{template?.name}</p>
                  <p className="text-white/80 text-xs">Layout: {template?.layout}</p>
                  <p className="text-white/80 text-xs">Industry: {template?.industry}</p>
                </div>
                <ImageUploader
                  siteId={template.site_id || ''}
                  templateId={template.id || ''}
                  folder="hero"
                  dbField="hero_url"
                  label="Hero Image"
                />

                <ImageUploader
                  siteId={template.site_id || ''}
                  templateId={template.id || ''}
                  folder="banners"
                  dbField="banner_url"
                  label="Banner Image"
                  initialUrl={template.banner_url}
                  onUpload={(url) => console.log('Banner uploaded:', url)}
                />

                <ImageUploader
                  siteId={template.site_id || ''}
                  templateId={template.id || ''}
                  folder="logos"
                  dbField="logo_url"
                  label="Logo Image"
                  initialUrl={template.logo_url}
                  onUpload={(url) => console.log('Logo updated:', url)}
                />

                <ImageUploader
                  siteId={template.site_id || ''}
                  templateId={template.id || ''}
                  folder="team"
                  dbField="team_url"
                  label="Team Photo"
                  initialUrl={template.team_url}
                  onUpload={(url) => console.log('Team updated:', url)}
                />

                <TemplateImageGallery templateId={template.id || ''} />
              </div>
              <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <DevicePreviewWrapper>
              <TemplatePreview
                data={livePreviewData as TemplateData}
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
          open={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          snapshotId={template?.id || ''}
        />
      </div>

      <TemplateActionToolbar
        template={template}
        autosaveStatus={autosave.status}
        onSaveDraft={handleSaveDraft}
      />
    </ScrollArea>
  );
}
