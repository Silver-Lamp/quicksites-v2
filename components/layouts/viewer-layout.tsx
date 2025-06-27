'use client';

import { ReactNode } from 'react';

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="viewer-layout p-6 text-white">
      <h1 className="text-xl font-semibold mb-4">Welcome, Viewer</h1>
      <main>{children}</main>
    </div>
  );
}
