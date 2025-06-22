import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import TemplateVersionDiff from './template-version-diff';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

export default function TemplateHistory({
  template,
  onRevert,
}: {
  template: any;
  onRevert: (data: any) => void;
}) {
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);

  useEffect(() => {
    if (!template?.template_name) return;

    supabase
      .from('template_versions')
      .select('*')
      .eq('template_name', template.template_name)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setVersions(data);
      });
  }, [template?.template_name]);

  const handleRevert = () => {
    if (!selectedVersion) return;
    onRevert({ ...template, data: selectedVersion.full_data });
    toast.success('Template reverted to selected version');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Version History</h2>
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.id} className="border p-3 rounded bg-white dark:bg-gray-900">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{v.commit_message || 'No message'}</p>
                <p className="text-xs text-gray-400">
                  {new Date(v.created_at || v.saved_at).toLocaleString()}
                </p>
                {v.thumbnail_url && (
                  <img
                    src={v.thumbnail_url}
                    alt="Preview thumbnail"
                    className="mt-2 w-32 rounded border border-gray-600 shadow-sm"
                  />
                )}
              </div>
              <button
                className="text-blue-500 underline text-xs"
                onClick={() => setSelectedVersion(v)}
              >
                View Diff
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selectedVersion && (
        <div id="version-diff-container" className="mt-6">
          <h3 className="text-sm font-semibold mb-2 text-gray-300">Diff from selected version:</h3>
          <TemplateVersionDiff current={template?.data} previous={selectedVersion.full_data} />
          <div className="flex gap-4 mt-3">
            <Button size="sm" variant="secondary" onClick={handleRevert}>
              Revert to This
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
