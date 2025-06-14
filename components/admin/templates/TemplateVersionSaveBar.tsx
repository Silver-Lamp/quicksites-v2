import { useState } from 'react';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { supabase } from '@/admin/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { uploadSnapshotToSupabase } from '@/admin/lib/uploadSnapshotToSupabase';

export default function TemplateVersionSaveBar({
  template,
  onSave
}: {
  template: any;
  onSave?: () => void;
}) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!template?.id || !template?.data) {
      toast.error('Template is incomplete');
      return;
    }

    setSaving(true);
    
    const thumbnailUrl = await uploadSnapshotToSupabase(template.id);
    await supabase.from('template_versions').insert([
      {
        template_id: template.id,
        template_name: template.template_name,
        data: template.data,
        commit: message,
        thumbnail_url: thumbnailUrl
      }
    ]);

    const { error } = await supabase.from('template_versions').insert([
      {
        template_id: template.id,
        template_name: template.template_name,
        data: template.data,
        commit: message
      }
    ]);

    setSaving(false);

    if (error) {
      toast.error('Failed to save version');
    } else {
      toast.success('Version saved!');
      onSave?.();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full bg-gray-900 text-white px-6 py-4 flex justify-between items-center z-50 border-t border-gray-700">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full max-w-md bg-gray-800 text-white border-gray-600"
        placeholder="Enter version commit message..."
      />
      <Button onClick={handleSave} className="ml-4" disabled={saving}>
        {saving ? 'Saving...' : 'Save Version'}
      </Button>
    </div>
  );
}
