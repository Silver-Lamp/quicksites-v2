'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const THUMIO_KEY = process.env.NEXT_PUBLIC_THUMIO_API_KEY;

export default function SeoPreviewThumbnail({
  pageUrl,
  ogImageUrl,
}: {
  pageUrl: string;
  ogImageUrl?: string;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const fallback = `https://image.thum.io/get/width/800/crop/768/${pageUrl}${
    THUMIO_KEY ? `?apikey=${THUMIO_KEY}` : ''
  }`;

  useEffect(() => {
    setImgSrc(ogImageUrl || fallback);
  }, [ogImageUrl, pageUrl]);

  return (
    <div className="mt-4 border border-white/10 rounded bg-neutral-800 p-2 w-full max-w-lg">
      <div className="text-xs text-white/60 mb-1">Preview Thumbnail</div>
      {imgSrc && (
        <Image
          src={imgSrc}
          alt="OG Preview"
          width={800}
          height={420}
          className="rounded w-full h-auto object-cover"
        />
      )}
    </div>
  );
}
