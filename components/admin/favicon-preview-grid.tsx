'use client';

import Image from 'next/image';

export default function FaviconPreviewGrid({
  urls,
}: {
  urls: Partial<Record<'16' | '32' | '48' | '64', string>>;
}) {
  return (
    <div className="grid grid-cols-4 gap-4 mt-4 text-center text-xs text-white/70">
      {(['16', '32', '48', '64'] as const).map((size) =>
        urls[size] ? (
          <div key={size}>
            <Image src={urls[size] as string} width={Number(size)} height={Number(size)} alt={`${size}px preview`} />
            <div>{size}×{size}</div>
          </div>
        ) : null
      )}
    </div>
  );
}
