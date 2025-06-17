import QRCode from 'react-qr-code';

export function ShareTools({ domain }: { domain: string }) {
  const url = `https://${domain}`;
  const share = () => navigator.clipboard.writeText(url);

  return (
    <div className="mt-6 text-white text-center">
      <QRCode value={url} className="mx-auto mb-2" />
      <p className="text-sm mb-1">{url}</p>
      <button
        onClick={share}
        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded"
      >
        Copy Link
      </button>
    </div>
  );
}
