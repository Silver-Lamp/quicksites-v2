'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { Label } from '@/components/ui';

interface TemplateEditorBrandingProps {
  selectedProfileId: string | null;
  onSelectProfileId: (id: string | null) => void;
}

export function TemplateEditorBranding({
  selectedProfileId,
  onSelectProfileId,
}: TemplateEditorBrandingProps) {
  const [brandingProfiles, setBrandingProfiles] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('branding_profiles')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setBrandingProfiles(data);
      });
  }, []);

  return (
    <div>
      <Label>Branding Profile</Label>
      <select
        className="border rounded px-2 py-1 w-full"
        value={selectedProfileId || ''}
        onChange={(e) => onSelectProfileId(e.target.value || null)}
      >
        <option value="">None</option>
        {brandingProfiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
