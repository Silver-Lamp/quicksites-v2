import QRCode from 'qrcode.react';
import { useEffect, useState } from 'react';

export function ShareTools({ domain, userId }: { domain: string, userId: string }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const full = \`https://\${domain}?ref=\${userId}\`;
    setUrl(full);
  }, [domain, userId]);

  const share = () => navigator.clipboard.writeText(url);

  return (
    <div className="mt-6 text-white text-center">
      <QRCode value={url} size={128} className="mx-auto mb-2" />
      <p className="text-sm mb-1">{url}</p>
      <button
        onClick={share}
        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded"
      >
        Copy Link with Referral
      </button>
    </div>
  );
}
