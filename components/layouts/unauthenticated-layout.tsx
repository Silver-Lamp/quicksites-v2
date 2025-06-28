'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function UnauthenticatedLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // You could vary style per route here if needed
  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-background text-foreground px-4">
      {children}
    </div>
  );
}
