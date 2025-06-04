import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

const themes = ['light', 'dark'];
const brands = ['green', 'blue', 'red'];

export default function ThemeBrandSwitcher({
  initialTheme = 'dark',
  initialBrand = 'green',
  onUpdate
}: {
  initialTheme?: string;
  initialBrand?: string;
  onUpdate?: (url: string, theme: string, brand: string, qr?: string) => void;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [brand, setBrand] = useState(initialBrand);
  const [url, setUrl] = useState('');
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const updated = `/api/og/snapshot?theme=${theme}&brand=${brand}`;
    setUrl(updated);
    QRCode.toDataURL(window.location.origin + updated).then((dataUrl) => {
      setQr(dataUrl);
      if (onUpdate) onUpdate(updated, theme, brand, dataUrl);
    });
  }, [theme, brand]);

  return (
    <div className="p-4 border rounded space-y-2 bg-white">
      <div className="flex gap-4">
        <label className="text-sm font-semibold">Theme:</label>
        {themes.map(t => (
          <button
            key={t}
            className={`text-sm px-2 py-1 border rounded ${t === theme ? 'bg-black text-white' : 'bg-gray-100'}`}
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
            className={`text-sm px-2 py-1 border rounded ${b === brand ? 'bg-black text-white' : 'bg-gray-100'}`}
            onClick={() => setBrand(b)}
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
          <img src={qr} alt="QR" className="w-24 h-24 border" />
        </div>
      )}
    </div>
  );
}
