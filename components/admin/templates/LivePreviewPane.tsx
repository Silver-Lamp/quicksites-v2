// components/admin/templates/LivePreviewPane.tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { Template } from '@/types/template';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import toast from 'react-hot-toast';

type Props = { template: Template };

export default function LivePreviewPane({ template }: Props) {
  const [pending, setPending] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [bustKey, setBustKey] = useState(0); // to refresh iframe

  // Compute best live URL we can show
  const liveUrl = useMemo(() => {
    // 1) Custom domain (if published)
    if (template.custom_domain && template.published) {
      return `https://${template.custom_domain}`;
    }
    // 2) Subdomain (if published)
    if (template.slug && template.published) {
      return `https://${template.slug}.quicksites.ai`;
    }
    // 3) Shared preview (volatile)
    if (sharedUrl) return sharedUrl;

    // 4) None yet
    return null;
  }, [template.custom_domain, template.slug, template.published, sharedUrl]);

  async function handleCreatePreview() {
    try {
      setPending(true);
      const res: any = await createSharedPreview(template as any);
      // assume util returns { url: string }
      if (res?.url as any) {
        setSharedUrl(res.url as any);
        toast.success('Live preview created!');
      } else {
        toast.error('Could not create preview.');
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create preview.');
    } finally {
      setPending(false);
    }
  }

  if (!liveUrl) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="max-w-md text-center space-y-4">
          <h3 className="text-lg font-semibold">No live preview yet</h3>
          <p className="text-sm text-muted-foreground">
            This template isn’t published to a domain or subdomain. You can
            generate a temporary share link to view it live in an iframe.
          </p>
          <Button onClick={handleCreatePreview} disabled={pending}>
            {pending ? 'Creating…' : 'Create Shared Preview'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <a
          href={liveUrl as string}
          target="_blank"
          rel="noreferrer"
          className="text-sm inline-flex items-center gap-2 underline"
        >
          Open in new tab <ExternalLink className="h-4 w-4" />
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBustKey((k) => k + 1)}
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <iframe
          key={bustKey}
          src={liveUrl as string}
          className="w-full h-[75vh]"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
