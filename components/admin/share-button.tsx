import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { useSharedPreview } from '@/hooks/useSharedPreview';

export default function ShareButton({
  templateId,
  templateName,
  templateData,
  theme,
  brand,
  colorScheme,
  commitMessage = '',
}: {
  templateId: string;
  templateName: string;
  templateData: any;
  theme?: string;
  brand?: string;
  colorScheme?: string;
  commitMessage?: string;
}) {
  const router = useRouter();
  const share = useSharedPreview();

  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    const id = await share({
      templateId,
      templateName,
      templateData,
      commitMessage,
      theme,
      brand,
      colorScheme,
    });
    setLoading(false);

    if (id) {
      toast.success('Preview shared!');
      router.push(`/shared/${id}`);
    } else {
      toast.error('Share failed');
    }
  };

  return (
    <Button onClick={handleShare} disabled={loading} variant="outline">
      {loading ? 'Sharing…' : 'Share Preview'}
      <span className="sr-only" aria-live="polite">
        {loading ? 'Sharing preview in progress' : ''}
      </span>
    </Button>
  );
}
