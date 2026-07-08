'use client';

// Reusable circular avatar of the QuickSites motif character ("the dude"). Crops
// the portrait to the face and rings it in the brand sky. Use anywhere a friendly
// guide/mascot presence helps (guest banner, empty states, onboarding).
import clsx from 'clsx';

export default function CharacterAvatar({
  size = 32,
  className,
  ring = true,
}: {
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/qs-character.jpg"
      alt="Your QuickSites guide"
      width={size}
      height={size}
      // object-position biases up toward the glasses/face rather than the beard.
      className={clsx(
        'shrink-0 rounded-full object-cover object-[50%_28%]',
        ring && 'ring-2 ring-sky-400/50 shadow-[0_0_16px_-4px_rgba(56,189,248,0.6)]',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
