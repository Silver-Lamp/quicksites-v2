'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { saveAsTemplate } from '@/admin/lib/saveAsTemplate';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';
import type { Template } from '@/types/template';

export function TemplateActionToolbar({
  template,
  autosaveStatus,
  onSaveDraft,
  onUndo,
  onRedo,
}: {
  template: Template;
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

      setStatus(template?.published ? 'Published' : 'Draft');
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
    };
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [template]);

  const handleSaveAs = async (type: 'template' | 'site') => {
    const newId = await saveAsTemplate(template, type);
    if (newId) {
      toast.success('Template copied');
      router.push(`/admin/templates?selected=${newId}`);
    } else {
      toast.error('Failed to copy template');
    }
  };

  const handleShare = async () => {
    const id = await createSharedPreview({
      templateId: template.id,
      templateName: template.template_name,
      templateData: template.data,
    });
    if (id) {
      toast.success('Preview shared!');
      router.push(`/shared/${id}`);
    } else {
      toast.error('Share failed');
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-gray-900 border border-gray-700 px-6 py-3 shadow-xl max-w-5xl w-[95%] flex justify-between items-center text-white opacity-80">
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
        <Button size="icon" variant="ghost" onClick={onUndo} title="Undo (⌘Z)">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onRedo} title="Redo (⇧⌘Z)">
          <RotateCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <select
          className="bg-gray-800 border border-gray-600 text-sm text-white rounded px-2 py-1"
          onChange={async (e) => {
          const versionId = e.target.value;
          if (!versionId || versionId === 'View Version') return;

          const { data, error } = await supabase
            .from('template_versions')
            .select('snapshot')
            .eq('id', versionId)
            .single();

          if (error || !data?.snapshot) {
            toast.error('Failed to load version');
            return;
          }

          if (confirm('Restore this version? This will overwrite the current draft.')) {
            const restored = {
              ...template,
              data: data.snapshot,
            };
            toast.success('Version restored!');
            location.reload();
          }
        }}
        >
          <option>View Version</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.commit_message || 'Untitled'} — {new Date(v.created_at).toLocaleDateString()}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (typeof onSaveDraft === 'function') {
              onSaveDraft();
            } else {
              toast.error('No save handler found');
            }
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleSaveAs('site')}>
          Duplicate as a Site
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleSaveAs('template')}>
          Duplicate as a Template
        </Button>
        <Button size="sm" variant="secondary" onClick={handleShare}>
          Share Snapshot
        </Button>
      </div>
    </div>
  );
}
