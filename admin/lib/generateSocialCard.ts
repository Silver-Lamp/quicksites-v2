import { toPng } from 'html-to-image';

export async function generateSocialCard({
  targetId = 'preview-capture',
  filename = 'social-preview.png',
  withWatermark = true
}: {
  targetId?: string;
  filename?: string;
  withWatermark?: boolean;
}) {
  const node = document.getElementById(targetId);
  if (!node) throw new Error('Target not found');

  if (withWatermark) {
    const watermark = document.createElement('div');
    watermark.textContent = 'quick.sites';
    watermark.style.position = 'absolute';
    watermark.style.bottom = '8px';
    watermark.style.right = '12px';
    watermark.style.fontSize = '10px';
    watermark.style.color = '#999';
    watermark.style.zIndex = '50';
    watermark.style.pointerEvents = 'none';
    node.appendChild(watermark);
  }

  const dataUrl = await toPng(node, { cacheBust: true });
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();

  if (withWatermark) {
    const last = node.lastChild;
    if (last) node.removeChild(last);
  }
}
