import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { supabase } from '@/admin/lib/supabaseClient';
import VersionCompareDropdowns from '@/components/admin/templates/version-compare-dropdowns';
import { renderVersionDiff } from '@/admin/utils/renderVersionDiff';

export default function VersionHistoryPanel({
  slug,
  onRestore,
}: {
  slug: string;
  onRestore: (snapshotId: string, brandingProfileId: string) => void;
}) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  useEffect(() => {
    const fetchVersions = async () => {
      const [versionRes, currentRes] = await Promise.all([
        supabase
          .from('published_versions')
          .select(
            `id, created_at, snapshot_id, label, slug, branding_profile_id, branding_profiles ( id, name, primary_color, secondary_color, font_family )`
          )
          .eq('slug', slug)
          .order('created_at', { ascending: false }),
        supabase.from('published_sites').select('snapshot_id').eq('slug', slug).maybeSingle(),
      ]);

      if (!versionRes.error) setVersions(versionRes.data || []);
      if (!currentRes.error && currentRes.data) setCurrentVersion(currentRes.data.snapshot_id);
      setLoading(false);
    };

    fetchVersions();
  }, [slug]);

  if (loading) return <p className="text-sm text-gray-500">Loading versions...</p>;
  if (versions.length === 0)
    return <p className="text-sm text-gray-500">No version history available.</p>;

  return (
    <div className="mt-4 space-y-2">
      <h3 className="font-semibold text-base">Version History</h3>
      <VersionCompareDropdowns slug={slug} onRestore={onRestore} />
      <ul className="space-y-2">
        {versions.map((v) => {
          const isCurrent = v.snapshot_id === currentVersion;
          return (
            <li
              key={v.id}
              className={`border rounded p-2 flex justify-between items-center ${isCurrent ? 'border-green-500' : 'border-gray-700'}`}
            >
              <div>
                <div className="text-sm text-gray-100">
                  Snapshot: <code>{v.snapshot_id}</code>
                </div>
                <div className="text-xs text-gray-400">Label: {v.label || 'No label'}</div>
                <div className="text-xs text-gray-500">
                  Published: {new Date(v.created_at).toLocaleString()}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{
                    fontFamily: v.branding_profiles?.font_family || 'sans-serif',
                  }}
                >
                  Heading Preview in {v.branding_profiles?.font_family || 'Default'}
                </div>
              </div>
              <div className="flex gap-2">
                {!isCurrent && (
                  <Button size="sm" onClick={() => onRestore(v.snapshot_id, v.branding_profile_id)}>
                    Restore
                  </Button>
                )}
                {confirmingDelete === v.id ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('published_versions')
                        .delete()
                        .eq('id', v.id);
                      if (!error) setVersions(versions.filter((ver) => ver.id !== v.id));
                      setConfirmingDelete(null);
                    }}
                  >
                    Confirm Delete
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setConfirmingDelete(v.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
