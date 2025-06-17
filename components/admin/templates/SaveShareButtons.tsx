import { useRouter } from 'next/router';
import { Button } from '@/components/admin/ui/button';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import toast from 'react-hot-toast';

export default function SaveShareButtons({ template }: { template: any }) {
  const router = useRouter();

  const handleSaveAs = async () => {
    const newId = await saveAsTemplate(template);
    if (newId) {
      toast.success('Template copied');
      router.push(`/admin/templates?selected=${newId}`);
    } else {
      toast.error('Failed to copy template');
    }
  };

  const handleShare = async () => {
    const id = await createSharedPreview(template.id);
    if (id) {
      toast.success('Preview shared!');
      router.push(`/shared/${id}`);
    } else {
      toast.error('Share failed');
    }
  };

  return (
    <div className="flex gap-2 mt-4">
      <Button variant="secondary" onClick={handleSaveAs}>
        Save As Template
      </Button>
      <Button variant="secondary" onClick={handleShare}>
        Share Snapshot
      </Button>
    </div>
  );
}
