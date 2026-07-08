'use client';

// Kept for its existing call sites (editor save/publish/working overlays). It now
// renders the branded video loader instead of the old static gif.
import BrandLoader from '@/components/brand/BrandLoader';

type Props = {
  open: boolean;
  message?: string;
};

export default function AsyncGifOverlay({ open, message }: Props) {
  return <BrandLoader open={open} message={message} />;
}
