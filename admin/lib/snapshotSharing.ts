import QRCode from 'qrcode';

export async function generateQRCode(url: string): Promise<string | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url);
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR code', err);
    return null;
  }
}

export function getSnapshotShareUrl(snapshotId: string): string {
  return `${window.location.origin}/shared/${snapshotId}`;
}

export function getDownloadableShareLink(snapshotId: string): string {
  return `${window.location.origin}/shared/${snapshotId}?download=true`;
}
