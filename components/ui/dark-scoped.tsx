'use client';

import { ReactNode } from 'react';

/**
 * Forces Tailwind `dark:` styles to apply inside this component
 * without affecting the global <html> or admin shell.
 */
export default function DarkScoped({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`dark ${className}`}>
      {children}
    </div>
  );
}
