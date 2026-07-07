// components/home/section-backdrop.tsx
//
// Subtle decorative image behind a homepage section, alternating down the page.
// Drops in as an absolute -z-10 layer inside an existing `relative` section, so
// section content (static flow) paints above it. Heavily scrimmed to preserve the
// dark theme + text contrast — the image reads as texture, not a photo.

const HOME_BACKDROPS = {
  meadow: '/backgrounds/home/meadow.jpg',
  bokeh: '/backgrounds/home/bokeh-table.jpg',
} as const;

export type HomeBackdrop = keyof typeof HOME_BACKDROPS;

export default function SectionBackdrop({
  image,
  opacity = 0.22,
}: {
  image: HomeBackdrop;
  opacity?: number;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HOME_BACKDROPS[image]})`, opacity }}
      />
      {/* Fade the top/bottom into the page so sections blend seamlessly, while
          letting the texture read through the middle band. */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/30 to-zinc-950" />
    </div>
  );
}
