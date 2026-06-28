// components/sites/preview-watermark.tsx
//
// Static overlay shown on shareable guest preview links (/preview?...&watermark=1).
// Server-safe (no client hooks). Fixed badge — pointer-events confined to the badge
// so it never blocks interaction with the previewed page.
import Link from 'next/link';

export default function PreviewWatermark() {
  return (
    <>
      {/* top ribbon */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2147483646] flex justify-center">
        <div className="pointer-events-auto mt-2 rounded-full border border-yellow-400/40 bg-yellow-100/95 px-4 py-1.5 text-xs font-medium text-yellow-900 shadow-md backdrop-blur">
          ✨ Preview — not yet published.{' '}
          <Link href="/" className="font-semibold underline underline-offset-2">
            Sign up to publish
          </Link>
        </div>
      </div>

      {/* corner badge */}
      <Link
        href="/"
        className="fixed bottom-3 right-3 z-[2147483646] rounded-md bg-zinc-900/85 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/10 transition hover:bg-zinc-900"
      >
        Made with <span className="text-sky-300">QuickSites</span>
      </Link>
    </>
  );
}
