'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type Platform = 'facebook' | 'twitter' | 'linkedin';

const platforms: Platform[] = ['facebook', 'twitter', 'linkedin'];

const getImage = (platform: Platform, url: string) => {
  const timestamp = Date.now();
  return `https://image.thum.io/get/width/600/crop/314/noanimate/${url}?_cb=${timestamp}`;
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

  useEffect(() => {
    const result: Record<Platform, string> = {} as any;
    platforms.forEach((platform) => {
      result[platform] = getImage(platform, url);
    });
    setPreviews(result);
    setFailed({ facebook: false, twitter: false, linkedin: false });
  }, [url]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-xs text-white/80">
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
  );
}
