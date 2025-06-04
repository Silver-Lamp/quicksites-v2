import { Button } from '../ui/button';
import { Dispatch, SetStateAction, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import toast from 'react-hot-toast';

type TemplateSaveBarProps = {
  template: any;
  rawJson: string;
  commitMessage: string;
  setSaveStatus: Dispatch<SetStateAction<'idle' | 'saved' | 'error'>>;
  setHighlightErrors: Dispatch<SetStateAction<boolean>>;
};

export default function TemplateSaveBar({
  template,
  rawJson,
  commitMessage,
  setSaveStatus,
  setHighlightErrors
}: TemplateSaveBarProps) {
  const [saveStatus, setLocalSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const handleSave = async () => {
    if (!template?.template_name || !template?.industry || !template?.layout || !template?.data?.pages?.length) {
      setHighlightErrors(true);
      return;
    }

    try {
      const { data: user } = await supabase.auth.getUser();
      const editor_id = user?.user?.email || 'unknown';
      const payload = { ...template, data: JSON.parse(rawJson) };

      const res = await fetch('/api/templates/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          commit_message: commitMessage,
          editor_id
        })
      });

      if (res.ok) {
        setLocalSaveStatus('saved');
        setSaveStatus('saved');
        toast.success('Template saved successfully.');
        setTimeout(() => {
          setLocalSaveStatus('idle');
          setSaveStatus('idle');
        }, 3000);
      } else {
        setLocalSaveStatus('error');
        setSaveStatus('error');
        toast.error('Failed to save template.');
      }
    } catch (err) {
      setLocalSaveStatus('error');
      setSaveStatus('error');
      toast.error('Failed to save template.');
    }
  };

  return (
    <div className="flex justify-between items-center fixed bottom-0 left-0 right-0 bg-background border-t p-4">
      <div className="flex items-center gap-2">
        <Button onClick={handleSave}>Save Changes</Button>
        {saveStatus === 'saved' && (
          <span className="text-green-500 text-xs animate-pulse">✓ Saved</span>
        )}
        {saveStatus === 'error' && (
          <span className="text-red-500 text-xs">⚠️ Error</span>
        )}
      </div>
    </div>
  );
}
