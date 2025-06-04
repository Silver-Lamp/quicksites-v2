import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/admin/lib/supabaseClient';

const themes = ['light', 'dark'];
const brands = ['green', 'blue', 'red'];

export default function ThemeBrandSwitcherAdvanced({
  profileId,
  initialTheme = 'dark',
  initialBrand = 'green',
  ownerId
}: {
  profileId: string;
  initialTheme?: string;
  initialBrand?: string;
  ownerId?: string;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [brand, setBrand] = useState(initialBrand);
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem('branding_theme');
    const storedBrand = localStorage.getItem('branding_brand');
    if (storedTheme && themes.includes(storedTheme)) setTheme(storedTheme);
    if (storedBrand && brands.includes(storedBrand)) setBrand(storedBrand);

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  useEffect(() => {
    const updated = `/api/og/snapshot?theme=${theme}&brand=${brand}`;
    setUrl(updated);
    QRCode.toDataURL(window.location.origin + updated).then(setQr);
    localStorage.setItem('branding_theme', theme);
    localStorage.setItem('branding_brand', brand);
  }, [theme, brand]);

  const saveDefaults = async () => {
    setSaving(true);
    await supabase.from('branding_profiles')
      .update({ theme, brand })
      .eq('id', profileId);
    setSaving(false);
    alert('Saved as default.');
  };

  const canSave = userId && ownerId && userId === ownerId;

  return (
    <div className="p-4 border rounded space-y-3 bg-white transition-all">
      <div className="flex gap-4">
        <label className="text-sm font-semibold">Theme:</label>
        {themes.map(t => (
          <button
            key={t}
            className={`text-sm px-2 py-1 border rounded transition-all ${t === theme ? 'bg-black text-white' : 'bg-gray-100'}`}
            onClick={() => setTheme(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <label className="text-sm font-semibold">Brand:</label>
        {brands.map(b => (
          <button
            key={b}
            className={`text-sm px-2 py-1 border rounded transition-all ${b === brand ? 'bg-black text-white' : 'bg-gray-100'}`}
            onClick={() => setBrand(b)}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mt-2 transition-opacity duration-300">
        <p className="text-xs">OG URL:</p>
        <code className="text-xs block bg-gray-100 p-2 rounded">{url}</code>
      </div>

      {qr && (
        <div className="mt-2 transition-opacity duration-300">
          <p className="text-xs text-muted-foreground">QR:</p>
          <img src={qr} alt="QR" className="w-24 h-24 border rounded shadow" />
        </div>
      )}

      {canSave && (
        <button
          onClick={saveDefaults}
          disabled={saving}
          className="text-xs mt-2 underline text-blue-600"
        >
          {saving ? 'Saving...' : 'Save as Default'}
        </button>
      )}
    </div>
  );
}
