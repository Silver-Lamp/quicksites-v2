// components/site/site-editor.tsx
'use client';

import { useState } from 'react';
import type { SiteData } from '@/types/site';
import { Button } from '@/components/ui/button';
import PageEditor from '../admin/templates/template-page-editor';
import toast from 'react-hot-toast';
import EditableSitePageEditor from './editable-site-page-editor';
import type { Template } from '@/types/template';
    
export default function SiteEditor({ site }: { site: SiteData }) {
  const [editingSite, setEditingSite] = useState(site);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const response = await fetch(`/api/site/${site.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(editingSite),
    });

    if (!response.ok) {
      toast.error('Failed to save site');
    } else {
      toast.success('Site saved!');
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Editing: <span className="text-muted-foreground">{site.site_name || site.slug}</span>
        </h1>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <EditableSitePageEditor
        data={editingSite.data as Template['data']}
        onChange={() => {}}
        // onChange={(updatedData) =>
        //     setEditingSite((prev) => ({
        //         ...prev,
        //         data: updatedData as Template['data'],
        //     }))
        // }
        />
    </div>
  );
}
