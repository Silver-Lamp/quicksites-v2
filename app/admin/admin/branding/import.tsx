import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BrandingImportPage() {
  const [importData, setImportData] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importData);
      const { error } = await supabase.from('branding_profiles').insert([parsed]);
      if (error) throw error;
      setFeedback('✅ Imported successfully');
    } catch (e) {
      setFeedback('❌ Invalid JSON or import error');
    }
  };

  const handleExport = async () => {
    const { data } = await supabase.from('branding_profiles').select('*').limit(1);
    if (data && data.length > 0) {
      const blob = new Blob([JSON.stringify(data[0], null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'branding-profile.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Import / Export Branding Profile</h1>

      <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded">
        Export Sample
      </button>

      <textarea
        className="w-full border rounded p-2 text-sm h-48"
        placeholder="Paste exported branding_profile JSON here..."
        value={importData}
        onChange={(e) => setImportData(e.target.value)}
      />

      <button onClick={handleImport} className="bg-green-600 text-white px-4 py-2 rounded">
        Import
      </button>

      {feedback && <p className="text-sm">{feedback}</p>}
    </div>
  );
}
