import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Dialog, DialogContent } from '@/components/admin/ui/dialog';
import { Button } from '@/components/admin/ui/button';
import toast from 'react-hot-toast';
import { supabase } from '@/admin/lib/supabaseClient';
// import VersionHistoryPanel from '@/components/templates/VersionHistoryPanel';
import VersionHistoryPanel from '@/components/admin/VersionHistoryPanel';
import PublishForm from '@/components/admin/PublishForm';
import { PublishSuccessPanel } from '@/components/admin/PublishSuccessPanel';
import { publishSite } from '@/admin/utils/publishSite';

export default function TemplatePublishModal({
  open,
  onClose,
  snapshotId,
  existingSlug = '',
  existingProfileId = '',
}: {
  open: boolean;
  onClose: () => void;
  snapshotId: string;
  existingSlug?: string;
  existingProfileId?: string;
}) {
  const router = useRouter();
  const [brandingProfiles, setBrandingProfiles] = useState<any[]>([]);
  const [profileId, setProfileId] = useState(existingProfileId);
  const [slug, setSlug] = useState(existingSlug);
  const [saving, setSaving] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState<string>('');
  const [isUpdateMode, setIsUpdateMode] = useState(!!existingSlug);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('branding_profiles')
      .select('id, name')
      .then(({ data }) => {
        if (data) setBrandingProfiles(data);
      });
  }, []);

  const handlePublish = async () => {
    setSaving(true);
    try {
      const url = await publishSite({
        slug,
        snapshotId,
        profileId,
        versionLabel,
        isUpdateMode,
      });
      setPublishedUrl(url);
      toast.success(isUpdateMode ? 'Site updated!' : 'Site published!');
      setTimeout(() => {
        router.push(`/sites/${slug}?version=${snapshotId}`);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-900 text-black dark:text-white space-y-4">
        <h2 className="text-lg font-bold">
          {isUpdateMode ? 'Update Site' : 'Publish Site'}
        </h2>

        <PublishForm
          slug={slug}
          setSlug={setSlug}
          profileId={profileId}
          setProfileId={setProfileId}
          versionLabel={versionLabel}
          setVersionLabel={setVersionLabel}
          brandingProfiles={brandingProfiles}
          saving={saving}
          isUpdateMode={isUpdateMode}
        />

        <Button onClick={handlePublish} disabled={saving}>
          {saving
            ? isUpdateMode
              ? 'Updating...'
              : 'Publishing...'
            : isUpdateMode
              ? 'Update Site'
              : 'Publish Site'}
        </Button>

        <Button
          variant="ghost"
          onClick={() => setVersionDrawerOpen(!versionDrawerOpen)}
        >
          {versionDrawerOpen ? 'Hide Versions' : 'Show Version History'}
        </Button>

        {versionDrawerOpen && (
          <VersionHistoryPanel
            slug={slug}
            onRestore={(snapshotId, brandingProfileId) => {
              setSlug(slug); // unchanged
              setProfileId(brandingProfileId);
              setIsUpdateMode(true);
              toast.success(
                'Restored values from version. Click Publish to apply.'
              );
            }}
          />
        )}

        {publishedUrl && <PublishSuccessPanel slug={slug} url={publishedUrl} />}
      </DialogContent>
    </Dialog>
  );
}
