import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SharePage() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') as string;
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    supabase
      .from('branding_profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [id]);

  const handleExport = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const el = document.getElementById('pdf-container');
    if (el) {
      html2pdf()
        .set({
          filename: `${profile.name}-preview.pdf`,
          margin: 10,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
    }
  };

  if (!profile) return <p className="p-6">Loading profile...</p>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div id="pdf-container" className="space-y-6 p-6 bg-white rounded shadow">
        <h1 className="text-xl font-bold">{profile.name}</h1>

        <div className="flex items-center gap-4">
          <p className="text-sm">
            Theme: <strong>{profile.theme}</strong>
          </p>
          <p className="text-sm">
            Brand: <strong>{profile.brand}</strong>
          </p>
        </div>

        {profile.logo_url && (
          <img src={profile.logo_url} alt="Logo" className="h-10 w-10 rounded-full border" />
        )}

        <p className="text-xs text-gray-400 text-right">Powered by QuickSites Studio</p>
      </div>

      <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleExport}>
        Download PDF
      </button>
    </div>
  );
}
