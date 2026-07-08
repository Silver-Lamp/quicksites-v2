'use client';

// Full-screen branded loading overlay: the QuickSites neon-steampunk motif video on
// a loop, framed in a glowing ring, with an optional status message. Small (~230KB
// mp4) with a poster frame for instant paint. Used for multi-second waits — site
// generation, publish, save — via AsyncGifOverlay and the guest builder.

export default function BrandLoader({ open, message }: { open: boolean; message?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative h-44 w-44 overflow-hidden rounded-2xl ring-1 ring-white/15 shadow-[0_0_70px_-10px_rgba(236,72,153,0.55)]">
        <video
          src="/brand/qs-loader.mp4"
          poster="/brand/qs-loader-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
        {/* Neon sheen sweeping across the frame while it works. */}
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-tr from-fuchsia-500/10 via-transparent to-sky-500/10" />
      </div>
      <div className="mt-5 flex items-center gap-1 text-sm text-white/90" role="status" aria-live="polite">
        <span>{message || 'Working'}</span>
        <span className="inline-flex gap-0.5">
          <span className="animate-bounce [animation-delay:-0.3s]">.</span>
          <span className="animate-bounce [animation-delay:-0.15s]">.</span>
          <span className="animate-bounce">.</span>
        </span>
      </div>
    </div>
  );
}
