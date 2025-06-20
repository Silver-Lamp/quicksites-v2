import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BrandingProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [profile, setProfile] = useState<any>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [accessOk, setAccessOk] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    supabase
      .from('branding_profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const accessParam = new URLSearchParams(window.location.search).get('access');
          if (!data.access_token && !data.password) {
            setAccessOk(true);
          } else if (data.access_token && accessParam === data.access_token) {
            setAccessOk(true);
          } else {
            setAccessOk(false);
          }
          setProfile(data);
          const previewUrl = `${window.location.origin}/api/og/snapshot?theme=${data.theme}&brand=${data.brand}`;
          QRCode.toDataURL(previewUrl).then(setQr);
        }
      });
  }, [id]);

  if (!profile) return <p className="p-6 text-sm text-muted-foreground">Loading profile...</p>;

  if (!accessOk && profile?.password) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Password Required</h2>
        <input
          className="border px-2 py-1 rounded mr-2"
          placeholder="Enter password"
          value={passwordAttempt}
          onChange={(e) => setPasswordAttempt(e.target.value)}
        />
        <button
          className="bg-black text-white px-3 py-1 rounded"
          onClick={() => {
            if (passwordAttempt === profile.password) setAccessOk(true);
            else alert('Incorrect password');
          }}
        >
          Submit
        </button>
      </div>
    );
  }

  const previewUrl = `/api/og/snapshot?theme=${profile.theme}&brand=${profile.brand}`;

  function downloadPDF() {
    const element = document.getElementById('branding-preview-pdf');
    if (element) {
      html2pdf()
        .set({
          filename: `${profile.name}-preview.pdf`,
          margin: 10,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div id="branding-preview-pdf" className="space-y-6">
        <h1 className="text-2xl font-bold">{profile.name}</h1>

        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Theme:</span>
          <span className="px-2 py-1 rounded bg-gray-200">{profile.theme}</span>

          <span className="text-sm font-medium">Brand:</span>
          <span className="px-2 py-1 rounded bg-gray-200">{profile.brand}</span>

          {profile.accent_color && (
            <span
              className="w-5 h-5 rounded-full border"
              style={{ backgroundColor: profile.accent_color }}
            />
          )}

          {profile.logo_url && (
            <img src={profile.logo_url} alt="Logo" className="w-8 h-8 rounded-full" />
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">OG Preview:</p>
          <img
            src={previewUrl}
            alt="OG Preview"
            className="w-full max-w-xl border shadow rounded"
          />
        </div>

        {qr && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">QR Code:</p>
            <img src={qr} alt="QR Code" className="w-32 h-32 border rounded" />
          </div>
        )}

        <div>
          <p className="text-sm">Link:</p>
          <code className="text-xs bg-gray-100 p-2 rounded block">{previewUrl}</code>
        </div>
      </div>

      <button className="bg-blue-600 text-white px-4 py-2 rounded mt-4" onClick={downloadPDF}>
        Download PDF Preview
      </button>
    </div>
  );
}
