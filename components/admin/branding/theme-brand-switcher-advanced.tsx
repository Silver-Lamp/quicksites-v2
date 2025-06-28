'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/admin/lib/supabaseClient';

const themes = ['light', 'dark'] as const;
const brands = ['green', 'blue', 'red'] as const;

type Theme = (typeof themes)[number];
type Brand = (typeof brands)[number];

type Props = {
  profileId: string;
  initialTheme?: Theme;
  initialBrand?: Brand;
  ownerId?: string;
};

export default function ThemeBrandSwitcherAdvanced({
  profileId,
  initialTheme = 'dark',
  initialBrand = 'green',
  ownerId,
}: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [brand, setBrand] = useState<Brand>(initialBrand);
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user ID and local storage preferences
  useEffect(() => {
    const storedTheme = localStorage.getItem('branding_theme') as Theme | null;
    const storedBrand = localStorage.getItem('branding_brand') as Brand | null;

    if (storedTheme && themes.includes(storedTheme)) setTheme(storedTheme);
    if (storedBrand && brands.includes(storedBrand)) setBrand(storedBrand);

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  // Update QR and URL when theme/brand change
  useEffect(() => {
    const updated = `/api/og/snapshot?theme=${theme}&brand=${brand}`;
    setUrl(updated);

    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${updated}` : updated;
    QRCode.toDataURL(fullUrl).then(setQr);

    localStorage.setItem('branding_theme', theme);
    localStorage.setItem('branding_brand', brand);
  }, [theme, brand]);

  const saveDefaults = async () => {
    setSaving(true);
    await supabase.from('branding_profiles').update({ theme, brand }).eq('id', profileId);
    setSaving(false);
    alert('Saved as default.');
  };

  const canSave = userId && ownerId && userId === ownerId;

  return (
    <div className="p-4 border rounded space-y-3 bg-white transition-all">
      <div className="flex gap-4">
        <label className="text-sm font-semibold">Theme:</label>
        {themes.map((t) => (
          <button
            key={t}
            aria-pressed={t === theme}
            onClick={() => setTheme(t)}
            className={`text-sm px-2 py-1 border rounded transition-all ${
              t === theme ? 'bg-black text-white' : 'bg-gray-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <label className="text-sm font-semibold">Brand:</label>
        {brands.map((b) => (
          <button
            key={b}
            aria-pressed={b === brand}
            onClick={() => setBrand(b)}
            className={`text-sm px-2 py-1 border rounded transition-all ${
              b === brand ? 'bg-black text-white' : 'bg-gray-100'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mt-2">
        <p className="text-xs">OG URL:</p>
        <code className="text-xs block bg-gray-100 p-2 rounded">{url}</code>
      </div>

      {qr && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">QR:</p>
          <img src={qr} alt="QR Code preview" className="w-24 h-24 border rounded shadow" />
        </div>
      )}

      {canSave && (
        <button
          onClick={saveDefaults}
          disabled={saving}
          className="text-xs mt-2 underline text-blue-600"
        >
          {saving ? 'Saving…' : 'Save as Default'}
        </button>
      )}
    </div>
  );
}
