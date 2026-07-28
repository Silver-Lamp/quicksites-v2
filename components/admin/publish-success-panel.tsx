import { Button } from '@/components/ui';
import QRCode from 'react-qr-code';
import QRCodeLib from 'qrcode';
import PersonaTestingPromo from '@/components/promo/persona-testing-promo';

export function PublishSuccessPanel({ slug, url }: { slug: string; url: string }) {
  return (
    <div className="mt-4 space-y-2 text-center">
      <p className="text-sm text-green-400">Site Published 🎉</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
        View Live Site
      </a>
      <div className="flex justify-center mt-2">
        <div className="flex flex-col items-center space-y-2">
          <QRCode value={url} size={128} />
          <span className="text-sm text-gray-300">{slug}.quicksites.ai</span>
        </div>
      </div>
      <div className="pt-2">
        <Button
          variant="secondary"
          onClick={async () => {
            const canvas = document.createElement('canvas');
            await QRCodeLib.toCanvas(canvas, url, { width: 256 });
            const link = document.createElement('a');
            link.download = `${slug}-qr.png`;
            link.href = canvas.toDataURL();
            link.click();
          }}
        >
          Download QR Code
        </Button>
      </div>

      {/* The highest-intent moment we have: they just shipped a site and don't yet know
          whether a stranger can use it. Copy + link live in the component, never here. */}
      <div className="pt-4">
        <PersonaTestingPromo variant="panel" />
      </div>
    </div>
  );
}
