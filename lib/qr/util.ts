// lib/qr/util.ts
// Helpers to extract an SVG string from a rendered <QRCode />,
// convert it to PNG, and trigger downloads in the browser.

export function getSvgStringFromNode(svg: SVGSVGElement): string {
    // Ensure width/height are present so the rasterizer knows target dimensions
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    return new XMLSerializer().serializeToString(clone);
  }
  
  export async function svgStringToPngDataUrl(svgString: string, size = 1024, bg = '#ffffff'): Promise<string> {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
  
    // Create <img> from SVG
    const img = new Image();
    // Important for cross-browser rasterization
    img.decoding = 'sync';
    img.crossOrigin = 'anonymous';
    const dataUrl: string = await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');
  
          // Fill background (for transparent SVGs)
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, size, size);
  
          // Draw image scaled to canvas
          ctx.drawImage(img, 0, 0, size, size);
          const url = canvas.toDataURL('image/png');
          resolve(url);
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  
    return dataUrl;
  }
  
  export function downloadDataUrl(filename: string, dataUrl: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  
  export function downloadTextAsFile(filename: string, text: string, mime = 'image/svg+xml;charset=utf-8') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(filename, url);
    URL.revokeObjectURL(url);
  }
  
  export function sanitizeFilename(input: string, fallback = 'qr'): string {
    return (input || fallback).toLowerCase().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  export async function svgStringToPngDataUrlWithOverlay(
    svgString: string,
    overlaySvgString?: string,
    size = 1024,
    bg = '#ffffff',
    overlayScalePct = 0.35
  ): Promise<string> {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
  
    const imgQr = new Image();
    imgQr.decoding = 'sync';
    imgQr.crossOrigin = 'anonymous';
  
    const dataUrl: string = await new Promise((resolve, reject) => {
      imgQr.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');
  
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, size, size);
  
          // draw QR
          ctx.drawImage(imgQr, 0, 0, size, size);
  
          // overlay (optional)
          if (overlaySvgString) {
            const iconBlob = new Blob([overlaySvgString], { type: 'image/svg+xml;charset=utf-8' });
            const iconUrl = URL.createObjectURL(iconBlob);
            const imgIcon = new Image();
            imgIcon.decoding = 'sync';
            imgIcon.crossOrigin = 'anonymous';
  
            imgIcon.onload = () => {
              try {
                const iconSize = Math.max(32, Math.min(size, size * overlayScalePct));
                const x = (size - iconSize) / 2;
                const y = (size - iconSize) / 2;
                ctx.drawImage(imgIcon, x, y, iconSize, iconSize);
                resolve(canvas.toDataURL('image/png'));
              } finally {
                URL.revokeObjectURL(iconUrl);
              }
            };
            imgIcon.onerror = reject;
            imgIcon.src = iconUrl;
          } else {
            resolve(canvas.toDataURL('image/png'));
          }
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      };
      imgQr.onerror = reject;
      imgQr.src = svgUrl;
    });
  
    return dataUrl;
  }
  