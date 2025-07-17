// components/ui/section-shell.tsx
import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  children: ReactNode;
  compact?: boolean;
  bg?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
};

export default function SectionShell({
  children,
  compact = false,
  bg = '',
  textAlign = 'left',
  className = '',
}: Props) {
  return (
    <section
      className={clsx(
        'w-full',
        bg,
        compact ? 'py-8' : 'py-16',
        'px-4 md:px-6 lg:px-8',
        className
      )}
    >
      <div className={clsx('max-w-5xl mx-auto', `text-${textAlign}`)}>{children}</div>
    </section>
  );
}
