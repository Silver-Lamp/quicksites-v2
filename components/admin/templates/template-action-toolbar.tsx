// components/admin/templates/template-action-toolbar.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';
import { usePanelControls } from '@/components/ui/panel-context';

export default function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
}: {  
  template: any;
  autosaveStatus?: string;
  onSaveDraft?: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState('Draft');
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => {
    if (template?.template_name) {
      supabase
        .from('template_versions')
        .select('id, commit_message, created_at')
        .eq('template_name', template.template_name)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setVersions(data);
        });

      setStatus(template?.published_at ? 'Published' : 'Draft');
    }
  }, [template?.template_name]);

  useEffect(() => {
    const handleHotkey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 's') {
        e.preventDefault();
        onSaveDraft?.();
      }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleShare();
      }
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toast.success('Copy preview (not implemented)');
      }
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [template]);

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
    <div className="fixed bottom-0 left-0 w-full z-40 border-t border-gray-700 bg-gray-900 px-6 py-3 flex justify-between items-center text-white">
      <div className="text-sm font-medium flex gap-4 items-center">
        <span>📄 {template.template_name}</span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            status === 'Published' ? 'bg-green-600' : 'bg-yellow-600'
          }`}
        >
          {status}
        </span>
        {autosaveStatus && (
          <span className="text-xs text-gray-400 italic">💾 {autosaveStatus}</span>
        )}
        {autosaveStatus === 'saved' && (
          <span className="text-xs text-green-400 animate-fade-out duration-1000">✓ Saved</span>
        )}
        {autosaveStatus === 'error' && <span className="text-xs text-red-400">⚠ Error</span>}
        <Button variant="ghost" onClick={onUndo}>
          Undo
        </Button>
        <Button variant="ghost" onClick={onRedo}>
          Redo
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="bg-gray-800 border border-gray-600 text-sm text-white rounded px-2 py-1"
          onChange={(e) => toast(`Selected version: ${e.target.value}`)}
        >
          <option>View Version</option>
          {versions.map((v) => (
            <option key={v.id}>
              {v.commit_message || 'Untitled'} — {new Date(v.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>

        <Button size="sm" variant="secondary" onClick={onSaveDraft}>
          Save Draft
        </Button>
        <Button size="sm" variant="secondary" onClick={handleSaveAs}>
          Save As Template
        </Button>
        <Button size="sm" variant="secondary" onClick={handleShare}>
          Share Snapshot
        </Button>
      </div>
    </div>
  );
}

export function PanelActions() {
  const { resetPanels, openAll, closeAll } = usePanelControls();

  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={openAll}>Open All</Button>
      <Button variant="ghost" size="sm" onClick={closeAll}>Collapse All</Button>
      <Button variant="outline" size="sm" onClick={resetPanels}>Reset Panel States</Button>
    </div>
  );
}