// components/ResponsivePreviewFrame.tsx
'use client';

import clsx from 'clsx';

export function ResponsivePreviewFrame({
  children,
  size = 'md',
}: {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}) {
  const sizeClass = {
    sm: 'w-[375px]',
    md: 'w-[768px]',
    lg: 'w-[1024px]',
    full: 'w-full',
  }[size];

  return (
    <div className="flex justify-center py-10 bg-neutral-900">
      <div className={clsx(sizeClass, 'border border-neutral-800 rounded-xl overflow-hidden')}>
        {children}
      </div>
    </div>
  );
}
