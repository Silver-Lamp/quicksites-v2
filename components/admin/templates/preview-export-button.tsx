import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui';
import toast from 'react-hot-toast';

export default function PreviewExportButton({
  targetId = 'preview-target',
  filename = 'template-preview.png',
}: {
  targetId?: string;
  filename?: string;
}) {
  const handleExport = async () => {
    const node = document.getElementById(targetId);
    if (!node) {
      toast.error('Preview target not found');
      return;
    }

    try {
      const dataUrl = await toPng(node, { cacheBust: true });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
      toast.success('Snapshot downloaded!');
    } catch (error) {
      toast.error('Failed to export preview');
      console.error(error);
    }
  };

  return (
    <Button onClick={handleExport} size="sm" variant="secondary">
      Download Snapshot
    </Button>
  );
}
