'use client';

type Props = {
  open: boolean;
  message?: string;
};

export default function AsyncGifOverlay({ open, message }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <img
        src="/loading-54.gif"
        alt="Loading..."
        className="w-40 h-40 mb-4"
      />
      {message && (
        <div className="text-white/90 text-sm text-center">{message}</div>
      )}
    </div>
  );
}
