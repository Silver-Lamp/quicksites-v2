'use client';

import * as React from 'react';

type Props = {
  url: string;
  title?: string;
  className?: string;
};

/** Loads the actual iframe/video only when visible */
export default function LazyVideoEmbed({ url, title = 'Demo', className }: Props) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  // Detect type
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const vm = u.match(/vimeo\.com\/(\d{6,})/);
  const isFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(u);

  return (
    <div ref={ref} className={className}>
      {!visible ? (
        <div className="h-full w-full grid place-items-center text-zinc-400 text-xs bg-zinc-900/60">
          Loading demo…
        </div>
      ) : yt ? (
        <iframe
          className="h-full w-full"
          src={`https://www.youtube.com/embed/${yt[1]}`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : vm ? (
        <iframe
          className="h-full w-full"
          src={`https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0`}
          title={title}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : isFile ? (
        <video className="h-full w-full" controls preload="metadata">
          <source src={u} />
        </video>
      ) : (
        <iframe className="h-full w-full" src={u} title={title} loading="lazy" />
      )}
    </div>
  );
}
