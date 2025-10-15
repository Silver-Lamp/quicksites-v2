// components/blocks/candidate/print-qr.tsx
'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';
import DownloadQR from '@/components/qr/DownloadQR';

type Variant = 'card' | 'sheet' | 'flyer';

type Content = {
  /** Prefer shortUrl if present */
  shortUrl?: string;
  url?: string;

  /** Labeling / meta */
  name?: string;           // e.g., "Daffy Duck"
  office?: string;         // e.g., "School Board — District 3"
  city?: string;           // e.g., "Fairfield, VA"
  title?: string;          // heading above the QR (defaults from name/office)
  subtitle?: string;       // smaller line under the title
  note?: string;           // footer note under/near the QR

  /** Visuals */
  logoUrl?: string;

  /** Controls */
  showDownload?: boolean;  // show PNG exporter button
  previewSize?: number;    // on-screen QR size for card/flyer
  exportSize?: number;     // PNG export size
  variant?: Variant;       // 'card' | 'sheet' | 'flyer' (default 'card')

  /** Sheet options (variant='sheet') */
  rows?: number;           // default 2
  cols?: number;           // default 4
  sheetQrSize?: number;    // QR size per card on sheet (default 148)
  showCutMarks?: boolean;  // add corner cut marks (default true)
  cardNote?: string;       // per-card note (fallback to `note`)

  /** Flyer options (variant='flyer') */
  flyerBullets?: string[]; // bullet points for flyer
  flyerEmphasis?: string;  // bold line near QR
};

export function CandidatePrintQRBlock({ content }: { content: Content }) {
  const {
    shortUrl,
    url,
    name,
    office,
    city,
    title,
    subtitle,
    note = 'Scan to learn more',
    logoUrl,
    showDownload = true,
    previewSize = 192,
    exportSize = 1024,
    variant = 'card',

    // sheet
    rows = 2,
    cols = 4,
    sheetQrSize = 148,
    showCutMarks = true,
    cardNote,

    // flyer
    flyerBullets = [],
    flyerEmphasis,
  } = content || {};

  const qrValue = shortUrl || url || '';

  const mainTitle =
    title ||
    [name, office].filter(Boolean).join(' — ') ||
    'Campaign QR';
  const subTitle =
    subtitle || city || (office && !title ? office : '') || '';

  function onPrint() {
    try {
      window.print();
    } catch {}
  }

  return (
    <section className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
      {/* Controls (hidden in print) */}
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <button
          onClick={onPrint}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Print
        </button>
        {showDownload && !!qrValue && (
          <DownloadQR
            value={qrValue}
            fileBaseName={(name || 'campaign').toLowerCase().replace(/\s+/g, '-') + '-qr'}
            previewSize={previewSize}
            exportSize={exportSize}
          />
        )}
      </div>

      {variant === 'sheet' ? (
        <Sheet
          qr={qrValue}
          title={mainTitle}
          subtitle={subTitle}
          note={cardNote ?? note}
          logoUrl={logoUrl}
          rows={rows}
          cols={cols}
          size={sheetQrSize}
          showCutMarks={showCutMarks}
        />
      ) : variant === 'flyer' ? (
        <Flyer
          qr={qrValue}
          title={mainTitle}
          subtitle={subTitle}
          note={note}
          logoUrl={logoUrl}
          size={Math.max(previewSize, 256)}
          emphasis={flyerEmphasis}
          bullets={flyerBullets}
        />
      ) : (
        <Card
          qr={qrValue}
          title={mainTitle}
          subtitle={subTitle}
          note={note}
          logoUrl={logoUrl}
          size={previewSize}
        />
      )}
    </section>
  );
}

/* ───────────────────────── card ───────────────────────── */

function Card({
  qr,
  title,
  subtitle,
  note,
  logoUrl,
  size,
}: {
  qr: string;
  title: string;
  subtitle?: string;
  note?: string;
  logoUrl?: string;
  size: number;
}) {
  return (
    <div
      className="
        mx-auto grid w-full max-w-2xl grid-cols-1 items-center gap-6 rounded-2xl border
        border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur
        dark:border-white/10 dark:bg-gray-900/60
        print:bg-white print:text-black print:shadow-none print:border-0 print:rounded-none
      "
    >
      {/* Heading */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="logo"
            className="h-10 w-10 rounded-md object-cover ring-1 ring-black/10 print:ring-0"
          />
        ) : null}
        <div>
          <h2 className="text-xl font-semibold leading-tight tracking-tight print:text-black">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 print:text-black/70">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* QR + URL */}
      <div className="flex items-center gap-6 print:gap-8">
        <div className="rounded-xl border border-white/10 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-white print:border-black/10 print:bg-white print:shadow-none">
          <QRCode value={qr || 'https://'} size={size} />
        </div>

        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 print:text-black/60">
            Link
          </div>
          <div className="truncate font-mono text-sm">
            {qr || '—'}
          </div>

          {note ? (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 print:text-black/70">
              {note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 print:text-black/60">
        Tip: Print this page or export the QR as PNG to place on flyers, yard signs, or handouts.
      </div>
    </div>
  );
}

/* ───────────────────────── sheet ───────────────────────── */

function Sheet({
  qr,
  title,
  subtitle,
  note,
  logoUrl,
  rows,
  cols,
  size,
  showCutMarks,
}: {
  qr: string;
  title: string;
  subtitle?: string;
  note?: string;
  logoUrl?: string;
  rows: number;
  cols: number;
  size: number;
  showCutMarks: boolean;
}) {
  const count = Math.max(1, rows * cols);
  const cards = Array.from({ length: count });

  return (
    <div className="mx-auto w-full max-w-[900px] print:max-w-none">
      <div
        className="
          grid gap-6 md:gap-8
          "
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {cards.map((_, i) => (
          <div key={i} className="relative">
            <SmallCard qr={qr} title={title} subtitle={subtitle} note={note} logoUrl={logoUrl} size={size} />
            {showCutMarks && <CutMarks />}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 print:text-black/60 print:mt-2">
        Sheet: {rows} × {cols} (total {count}). Use “Fit to page” when printing if needed.
      </p>
    </div>
  );
}

function SmallCard({
  qr,
  title,
  subtitle,
  note,
  logoUrl,
  size,
}: {
  qr: string;
  title: string;
  subtitle?: string;
  note?: string;
  logoUrl?: string;
  size: number;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 print:border-black/20">
      <div className="mb-2 flex items-center gap-2">
        {logoUrl ? <img src={logoUrl} alt="logo" className="h-6 w-6 rounded object-cover" /> : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          {subtitle ? <div className="truncate text-xs text-gray-600">{subtitle}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-md border border-black/10 bg-white p-2">
          <QRCode value={qr || 'https://'} size={size} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">Link</div>
          <div className="truncate font-mono text-xs">{qr || '—'}</div>
          {note ? <div className="mt-2 text-[12px] text-gray-700">{note}</div> : null}
        </div>
      </div>
    </div>
  );
}

function CutMarks() {
  // four corner marks around the card
  return (
    <>
      <div className="pointer-events-none absolute -left-2 -top-2 h-6 w-6 border-l-2 border-t-2 border-black/40 print:border-black" />
      <div className="pointer-events-none absolute -right-2 -top-2 h-6 w-6 border-r-2 border-t-2 border-black/40 print:border-black" />
      <div className="pointer-events-none absolute -left-2 -bottom-2 h-6 w-6 border-l-2 border-b-2 border-black/40 print:border-black" />
      <div className="pointer-events-none absolute -right-2 -bottom-2 h-6 w-6 border-r-2 border-b-2 border-black/40 print:border-black" />
    </>
  );
}

/* ───────────────────────── flyer ───────────────────────── */

function Flyer({
  qr,
  title,
  subtitle,
  note,
  logoUrl,
  size,
  emphasis,
  bullets,
}: {
  qr: string;
  title: string;
  subtitle?: string;
  note?: string;
  logoUrl?: string;
  size: number;
  emphasis?: string;
  bullets: string[];
}) {
  return (
    <div
      className="
        mx-auto grid max-w-[900px] grid-cols-1 gap-8 rounded-2xl border
        border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur
        dark:border-white/10 dark:bg-gray-900/60
        print:max-w-none print:rounded-none print:border-0 print:bg-white print:shadow-none
      "
    >
      <div className="flex items-center gap-3">
        {logoUrl ? <img src={logoUrl} alt="logo" className="h-12 w-12 rounded-md object-cover ring-1 ring-black/10 print:ring-0" /> : null}
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight print:text-black">{title}</h2>
          {subtitle ? <p className="text-base text-gray-600 dark:text-gray-300 print:text-black/70">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="rounded-xl border border-white/10 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-white print:border-black/10 print:bg-white print:shadow-none">
          <QRCode value={qr || 'https://'} size={size} />
        </div>
        <div className="min-w-0">
          {emphasis ? <div className="mb-3 text-lg font-semibold">{emphasis}</div> : null}
          {bullets?.length ? (
            <ul className="mb-3 list-disc pl-4 text-sm leading-6">
              {bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
          {note ? <div className="text-sm text-gray-600 dark:text-gray-300 print:text-black/70">{note}</div> : null}
          <div className="mt-3 text-xs text-gray-500 print:text-black/60">
            Link: <span className="font-mono">{qr || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
