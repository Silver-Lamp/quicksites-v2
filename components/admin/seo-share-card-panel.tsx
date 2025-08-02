'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type Platform = 'facebook' | 'twitter' | 'linkedin';
const platforms: Platform[] = ['facebook', 'twitter', 'linkedin'];

const getImage = (platform: Platform, url: string, cacheBust = false) => {
  const apikey = process.env.NEXT_PUBLIC_THUMIO_API_KEY;
  const cbParam = cacheBust ? `&_cb=${Date.now()}` : '';
  return `https://image.thum.io/get/width/600/crop/314/noanimate/${url}${
    apikey ? `?apikey=${apikey}${cbParam}` : cbParam ? `?${cbParam}` : ''
  }`;
};


export default function SeoShareCardPanel({ url }: { url: string }) {
  const [previews, setPreviews] = useState<Record<Platform, string | null>>({
    facebook: null,
    twitter: null,
    linkedin: null,
  });
  const [failed, setFailed] = useState<Record<Platform, boolean>>({
    facebook: false,
    twitter: false,
    linkedin: false,
  });

  const generatePreviews = (cacheBust = false) => {
    const result: Record<Platform, string> = {} as any;
    platforms.forEach((platform) => {
      result[platform] = getImage(platform, url, cacheBust);
    });
    setPreviews(result);
    setFailed({ facebook: false, twitter: false, linkedin: false });
  };

  useEffect(() => {
    generatePreviews(false); // initial load without cache busting
  }, [url]);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium text-white/70">Share Card Previews</div>
        <button
          onClick={() => generatePreviews(true)}
          className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
        >
          Refresh Previews
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-white/80">
        {platforms.map((platform) => (
          <div key={platform} className="bg-neutral-900 border border-white/10 rounded p-2">
            <div className="mb-2 font-semibold capitalize">{platform}</div>
            {previews[platform] && !failed[platform] ? (
              <Image
                src={previews[platform] as string}
                alt={`${platform} preview`}
                width={600}
                height={314}
                className="w-full h-auto object-cover rounded"
                onError={() => {
                  setFailed((prev) => ({ ...prev, [platform]: true }));
                }}
              />
            ) : (
              <div className="h-[314px] w-full flex items-center justify-center text-white/40 text-xs bg-neutral-800 rounded">
                Failed to load preview
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
