// components/qr/StickerSheet.tsx
'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';

import { STICKER_PRESETS } from '@/lib/qr/sticker-presets';
import {
  getSvgStringFromNode,
  sanitizeFilename,
  svgStringToPngDataUrl,
  svgStringToPngDataUrlWithOverlay,
} from '@/lib/qr/util';
import { buildStickerSheetPdf, downloadPdf } from '@/lib/qr/sticker';
import { ICONS } from '@/lib/qr/icons';

type Props = {
  /** QR content (usually the short URL) */
  value: string;
  /** Base filename for exported files (defaults to "qr-stickers") */
  fileBaseName?: string;
  /** Optional caption printed under each QR (e.g., electinfo.org/c/xy) */
  caption?: string;
  /** Default label preset id (e.g., "avery-5160", "avery-6450-round-2.5in") */
  defaultPresetId?: string;
  /** Initial QR render size in px for the preview (PNG rendering uses >= this) */
  initialQrSize?: number;
};

export default function StickerSheet({
  value,
  fileBaseName = 'qr-stickers',
  caption,
  defaultPresetId = 'avery-5160',
  initialQrSize = 512,
}: Props) {
  // We avoid attaching ref to <QRCode /> due to library typing quirks.
  // Instead, keep a wrapper ref and query the inner <svg>.
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Layout / preset controls
  const [presetId, setPresetId] = React.useState(defaultPresetId);
  const preset = STICKER_PRESETS.find((p) => p.id === presetId) ?? STICKER_PRESETS[0];

  // QR render & layout tuning
  const [qrSize, setQrSize] = React.useState(initialQrSize);
  const [qrPaddingPct, setQrPaddingPct] = React.useState(0.12);

  // Visual helpers
  const [showCutGuides, setShowCutGuides] = React.useState(true);

  // Center icon overlay
  const [withCenterIcon, setWithCenterIcon] = React.useState(false);
  const [iconPreset, setIconPreset] = React.useState<'peaceV' | 'check'>('peaceV');
  const [overlayScalePct, setOverlayScalePct] = React.useState(0.35);

  // Caption fitting (raster path; vector path fits server-side)
  const [autoFitCaption, setAutoFitCaption] = React.useState(true);
  const [captionMin, setCaptionMin] = React.useState(6);
  const [captionMax, setCaptionMax] = React.useState(9);
  const [captionSafeMarginPct, setCaptionSafeMarginPct] = React.useState(0.06);

  // UX
  const [working, setWorking] = React.useState<'raster' | 'vector' | null>(null);
  const name = sanitizeFilename(fileBaseName || 'qr-stickers');

  // Helper to get the live SVG element
  const getSvgEl = React.useCallback(() => {
    return (wrapRef.current?.querySelector('svg') as SVGSVGElement | null) ?? null;
  }, []);

  async function onDownloadRaster() {
    const svgEl = getSvgEl();
    if (!svgEl) return;
    setWorking('raster');
    try {
      const svgString = getSvgStringFromNode(svgEl);
      const pngDataUrl = await (withCenterIcon
        ? svgStringToPngDataUrlWithOverlay(
            svgString,
            ICONS[iconPreset],
            Math.max(qrSize, 512),
            '#ffffff',
            overlayScalePct
          )
        : svgStringToPngDataUrl(svgString, Math.max(qrSize, 512)));
      const pngBytes = new Uint8Array(await (await fetch(pngDataUrl)).arrayBuffer());
      const pdfBytes = await buildStickerSheetPdf(pngBytes, preset, {
        qrPaddingPct: qrPaddingPct,
        caption,
        autoFitCaption,
        captionMin,
        captionMax,
        captionSafeMarginPct,
        ellipsize: true,
        showCutGuides,
      });
      downloadPdf(`${name}-${preset.id}.pdf`, pdfBytes);
    } catch (e) {
      alert('Raster PDF export failed. See console for details.');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setWorking(null);
    }
  }

  async function onDownloadVector() {
    setWorking('vector');
    try {
      const res = await fetch('/api/qr/sticker-vector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          presetId,
          paddingPct: qrPaddingPct,
          caption,
          showCutGuides,
          centerIcon: withCenterIcon ? { preset: iconPreset, sizePct: overlayScalePct } : undefined,
          autoFitCaption,
          captionMin,
          captionMax,
          captionSafeMarginPct,
          ellipsize: true,
        }),
      });
      if (!res.ok) {
        alert('Vector PDF export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-${presetId}-vector.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Vector PDF export failed. See console for details.');
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="rounded-2xl border p-4 dark:border-gray-700">
      <div className="text-sm font-semibold mb-3">Sticker Sheet (PDF)</div>

      {/* QR preview (SVG) */}
      <div
        ref={wrapRef}
        className="inline-block rounded-xl border bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <QRCode value={value} size={qrSize} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {/* Layout */}
        <label className="text-sm">
          Layout
          <select
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
          >
            {STICKER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {/* Preview size */}
        <label className="text-sm">
          QR render size (px)
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={qrSize}
            min={256}
            onChange={(e) => setQrSize(Math.max(256, Number(e.target.value) || initialQrSize))}
          />
        </label>

        {/* Padding inside label */}
        <label className="text-sm">
          Padding inside label (0–0.45)
          <input
            type="number"
            step="0.01"
            min={0}
            max={0.45}
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={qrPaddingPct}
            onChange={(e) => setQrPaddingPct(Math.min(0.45, Math.max(0, Number(e.target.value))))}
          />
        </label>

        {/* Center icon */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withCenterIcon}
            onChange={(e) => setWithCenterIcon(e.target.checked)}
          />
          Center icon
        </label>

        {withCenterIcon && (
          <>
            <label className="text-sm">
              Icon preset
              <select
                className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
                value={iconPreset}
                onChange={(e) => setIconPreset(e.target.value as 'peaceV' | 'check')}
              >
                <option value="peaceV">Peace / V</option>
                <option value="check">Checkmark</option>
              </select>
            </label>
            <label className="text-sm">
              Icon scale (0.05–0.9)
              <input
                type="number"
                step={0.01}
                min={0.05}
                max={0.9}
                className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
                value={overlayScalePct}
                onChange={(e) =>
                  setOverlayScalePct(Math.min(0.9, Math.max(0.05, Number(e.target.value))))
                }
              />
            </label>
          </>
        )}

        {/* Cut guides */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCutGuides}
            onChange={(e) => setShowCutGuides(e.target.checked)}
          />
          Show cut guides
        </label>

        {/* Caption auto-fit controls */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoFitCaption}
            onChange={(e) => setAutoFitCaption(e.target.checked)}
          />
          Auto-fit caption
        </label>

        <label className="text-sm">
          Caption min (pt)
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={captionMin}
            min={5}
            onChange={(e) => setCaptionMin(Math.max(5, Number(e.target.value) || 6))}
          />
        </label>

        <label className="text-sm">
          Caption max (pt)
          <input
            type="number"
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={captionMax}
            min={captionMin}
            max={14}
            onChange={(e) =>
              setCaptionMax(Math.min(14, Math.max(captionMin, Number(e.target.value) || 9)))
            }
          />
        </label>

        <label className="text-sm">
          Caption safe margin (0–0.3)
          <input
            type="number"
            step="0.01"
            min={0}
            max={0.3}
            className="mt-1 w-full rounded border px-2 py-1 dark:border-gray-700"
            value={captionSafeMarginPct}
            onChange={(e) =>
              setCaptionSafeMarginPct(Math.min(0.3, Math.max(0, Number(e.target.value))))
            }
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDownloadRaster}
          disabled={working !== null}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900"
        >
          {working === 'raster' ? 'Building…' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={onDownloadVector}
          disabled={working !== null}
          className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {working === 'vector' ? 'Building…' : 'Download Vector PDF (server)'}
        </button>
      </div>

      {caption && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">Caption: {caption}</div>
      )}
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        Tip: Use SVG for sign shops; PDF for label sheets. Tweak preset margins by ±2–3 pt if needed.
      </div>
    </div>
  );
}
