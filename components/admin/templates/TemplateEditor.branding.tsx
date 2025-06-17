// Inside TemplateEditor component

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import { Label } from '@/components/ui/label';

const [brandingProfiles, setBrandingProfiles] = useState<any[]>([]);
const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

useEffect(() => {
  supabase
    .from('branding_profiles')
    .select('id, name')
    .order('created_at', { ascending: false })
    .then(({ data }) => {
      if (data) setBrandingProfiles(data);
    });
}, []);

// Add this inside your JSX (e.g. below the "Tags" input or Commit Message)
<div>
  <Label>Branding Profile</Label>
  <select
    className="border rounded px-2 py-1 w-full"
    value={selectedProfileId || ''}
    onChange={(e) => setSelectedProfileId(e.target.value || null)}
  >
    <option value="">None</option>
    {brandingProfiles.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    ))}
  </select>
</div>;
