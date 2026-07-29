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

      {/* Corner badge — bottom-LEFT so it never overlaps the bottom-right preview
          color-mode toggle (PreviewColorToggle) on mobile.

          STACKED ABOVE the "Hear this page" launcher, which is also fixed bottom-left
          (components/hear-this-page.tsx, `bottom-4 left-4`). This badge carries
          z-[2147483646], so at the same offset it sat directly on top of the launcher and hid
          it — on every unclaimed listing-import draft, which is where both appear together.
          The launcher keeps the bottom slot because it is the interactive control and belongs
          within thumb reach; this badge is a static link and reads fine above it.

          If the launcher is absent (flag off, or dismissed) this floats one slot high. That is
          a deliberate trade: a small gap on some pages beats a hidden control on all of them.

          Stacked at every breakpoint rather than sitting beside the launcher on desktop:
          stacking depends only on the launcher's HEIGHT, which is stable, while side-by-side
          would depend on its WIDTH — and its label ("Hear this page") is configurable. */}
      <Link
        href="/"
        className="fixed bottom-[4.25rem] left-3 z-[2147483646] rounded-md bg-zinc-900/85 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg ring-1 ring-white/10 transition hover:bg-zinc-900"
      >
        Made with <span className="text-sky-300">QuickSites</span>
      </Link>
    </>
  );
}
