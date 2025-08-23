// panels/DomainPanel.tsx
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DomainInstructions from '@/components/admin/domain-instructions';
import FaviconUploader from '@/components/admin/favicon-uploader';
import OGBulkRebuild from '@/components/admin/og-bulk-rebuild';
import SeoPreviewTestLinks from '@/components/admin/seo-preview-test-links';
import SeoPreviewThumbnail from '@/components/admin/seo-preview-thumbnail';
import SeoShareCardPanel from '@/components/admin/seo-share-card-panel';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import type { Template } from '@/types/template';

// ❗️ use a **browser** supabase client in this panel
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import * as React from 'react';
import { Image as ImageIcon, Wand2 } from 'lucide-react';

export default function DomainPanel({
  template,
  onChange,
  isSite,
}: {
  template: Template;
  onChange: (updated: Template) => void;
  isSite: boolean;
}) {
  // make a single browser client (inherits session from local storage)
  const sb = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [genBusy, setGenBusy] = React.useState(false);
  const [fromLogoBusy, setFromLogoBusy] = React.useState(false);

  const handleTogglePublished = async (value: boolean) => {
    const updated = { ...template, published: value };
    onChange(updated);
    const { error } = await sb.from('templates').update({ published: value }).eq('id', template.id);
    if (error) {
      toast.error('Failed to update publish status');
      onChange({ ...template, published: !value });
    } else {
      toast.success(value ? 'Template published' : 'Template unpublished');
    }
  };

  const setFaviconUrl = async (url: string) => {
    const nextMeta = { ...(template.meta || {}), favicon_url: url };
    onChange({ ...template, meta: nextMeta });
    const { error } = await sb.from('templates').update({ meta: nextMeta }).eq('id', template.id);
    if (error) toast.error('Failed to save favicon URL');
    else toast.success('Favicon updated');
  };

  const ensureAuthed = async () => {
    const { data } = await sb.auth.getUser();
    if (!data?.user) {
      toast.error('Please sign in again to upload');
      throw new Error('Not authenticated');
    }
  };

  const uploadFaviconBlob = async (blob: Blob, nameBase = 'favicon') => {
    await ensureAuthed();
    const fileName = `template-${template.id}/${nameBase}-${Date.now()}.png`;
    const { error } = await sb.storage.from('favicons').upload(fileName, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/png',
    });
    if (error) throw new Error(error.message || 'Upload failed');
    const { data } = sb.storage.from('favicons').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const dataUrlFromCanvas = (canvas: HTMLCanvasElement) =>
    new Promise<string>((resolve) => resolve(canvas.toDataURL('image/png')));
  const blobFromDataURL = async (dataUrl: string) => await (await fetch(dataUrl)).blob();

  const rasterizeSquare = async (srcUrl: string, size = 32) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = srcUrl;
    await new Promise((res, rej) => { img.onload = () => res(true); img.onerror = rej; });
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const scale = Math.max(size / iw, size / ih);
    const dw = iw * scale, dh = ih * scale;
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, dx, dy, dw, dh);
    const dataUrl = await dataUrlFromCanvas(canvas);
    return await blobFromDataURL(dataUrl);
  };

  const generateFaviconAI = async () => {
    setGenBusy(true);
    try {
      const res = await fetch('/api/favicon/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          business_name: (template as any)?.business_name,
          industry: template.industry,
          size: '1024x1024',
          transparent: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Generate failed (${res.status})`);
      const b64 = json.image_base64 as string;
      if (!b64) throw new Error('No image returned');

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob1024 = new Blob([bytes], { type: 'image/png' });

      const tmpUrl = URL.createObjectURL(blob1024);
      const blob32 = await rasterizeSquare(tmpUrl, 32);
      URL.revokeObjectURL(tmpUrl);

      const url32 = await uploadFaviconBlob(blob32, 'favicon-32');
      await setFaviconUrl(url32);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Favicon generation failed');
    } finally {
      setGenBusy(false);
    }
  };

  const makeFaviconFromLogo = async () => {
    const logo = (template as any)?.logo_url;
    if (!logo) { toast.error('No header logo found to convert.'); return; }
    setFromLogoBusy(true);
    try {
      const blob32 = await rasterizeSquare(logo, 32);
      const url32 = await uploadFaviconBlob(blob32, 'favicon-32');
      await setFaviconUrl(url32);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create favicon from logo');
    } finally {
      setFromLogoBusy(false);
    }
  };

  const currentFavicon = (template.meta as any)?.favicon_url || '';

  return (
    <Collapsible title="Publishing & Domain" id="publishing-domain">
      {/* …rest of your UI… */}
      <div className="flex gap-2 items-center flex-wrap">
        <DomainInstructions domain={template.custom_domain || ''} />
        {/* <FaviconUploader
          templateId={template.id}
          currentUrl={currentFavicon}
          onUpload={(url) => setFaviconUrl(url)}
          bucket="favicons"                               // ✅ keep consistent
          folder={`template-${template.id}`}              // optional prefix
        /> */}

        {/* <div className="flex items-center gap-2">
          <Button size="sm" onClick={generateFaviconAI} disabled={genBusy}>
            <Wand2 className="h-4 w-4 mr-1" /> {genBusy ? 'Generating…' : 'AI Favicon'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={makeFaviconFromLogo}
            disabled={fromLogoBusy || !(template as any)?.logo_url}
          >
            <ImageIcon className="h-4 w-4 mr-1" /> {fromLogoBusy ? 'Processing…' : 'From Logo'}
          </Button>
        </div> */}

        {/* …other controls… */}
      </div>
    </Collapsible>
  );
}
