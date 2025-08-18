import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import QRCode from 'qrcode';
import Image from 'next/image';
import TemplatePreview from '@/components/admin/templates/template-preview';
import { Button } from '@/components/ui';
import { generateSocialCard } from '@/admin/lib/generateSocialCard';

export default function SharedSnapshotPage() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') as string;
  const v = searchParams?.get('v') as string;

  const [template, setTemplate] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    QRCode.toDataURL(`${window.location.origin}/shared/${id}`).then(setQrDataUrl);

    const loadData = async () => {
      let res;
      if (v) {
        res = await supabase
          .from('template_versions')
          .select('full_data, template_name, commit_message')
          .eq('id', v)
          .single();
      } else {
        res = await supabase
          .from('snapshots')
          .select(
            'data, template_name, editor_email, shared_at, thumbnail_url, theme, brand, color_scheme, is_site, published'
          )
          .eq('id', id)
          .single();
      }
      if (res.data) setTemplate(res.data);
    };

    loadData();
  }, [id, v]);

  const isDark = template?.theme === 'dark';
  const brand = template?.brand || 'blue';

  const themeClasses = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';

  const brandClass =
    brand === 'green' ? 'text-green-400' : brand === 'red' ? 'text-red-400' : 'text-blue-400';

  if (!template) return <div className="text-white p-10">Loading shared preview...</div>;

  return (
    <div
      className={`min-h-screen px-4 sm:px-6 py-10 max-w-screen-lg mx-auto space-y-6 ${themeClasses}`}
    >
      <h1 className={`text-2xl font-bold ${brandClass}`}>Shared Snapshot</h1>

      <div className="flex flex-wrap items-center gap-6">
        {qrDataUrl && (
          <div>
            <Image src={qrDataUrl} alt="QR code" width={120} height={120} />
          </div>
        )}
        {template?.thumbnail_url && (
          <div className="max-w-[320px]">
            <img
              src={template.thumbnail_url}
              alt="Snapshot preview"
              className="rounded shadow border border-gray-600"
            />
          </div>
        )}
      </div>

      <div
        className="border rounded bg-white dark:bg-gray-800 shadow-md overflow-x-auto p-4"
        id="preview-capture"
        >
          <TemplatePreview
            data={template.data}
            theme={template.theme}
            brand={template.brand}
            colorScheme={template.color_scheme}
            onBlockClick={(block) => {
              console.log('block: ', block);
            }}
            showJsonFallback={true}
            mode="dark"
          />
      </div>

      <div className="flex flex-wrap gap-3 mt-6 justify-between">
        <Button variant="outline" onClick={() => (window.location.href = `/templates/new?from=${id}`)}>
          Remix This
        </Button>
        <Button onClick={() => generateSocialCard({})} variant="secondary">
          Download PNG
        </Button>
      </div>
    </div>
  );
}
