import { supabase } from '@/admin/lib/supabaseClient';
import QRCodeLib from 'qrcode';

export async function uploadQRCodeImage(
  slug: string,
  url: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  await QRCodeLib.toCanvas(canvas, url, { width: 512 });

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not create QR blob'));

      const { error } = await supabase.storage
        .from('qr-codes')
        .upload(`sites/${slug}.png`, blob, {
          upsert: true,
          contentType: 'image/png',
        });

      if (error) return reject(error);

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/qr-codes/sites/${slug}.png`;
      resolve(publicUrl);
    });
  });
}
