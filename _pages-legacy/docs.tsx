'use client';

import dynamic from 'next/dynamic';
import { useState, type ComponentType } from 'react';

// Safely cast to unknown, then to expected component type
const SwaggerUI = dynamic(
  () => import('swagger-ui-react') as unknown as Promise<ComponentType<{ url: string }>>,
  {
    ssr: false,
  }
);

const RedocStandalone = dynamic(() => import('redoc').then((mod) => mod.RedocStandalone), {
  ssr: false,
});

export default function DocsPage() {
  const [view, setView] = useState<'swagger' | 'redoc'>('swagger');

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">📘 API Docs</h1>
        <button
          className="text-sm px-3 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
          onClick={() => setView(view === 'swagger' ? 'redoc' : 'swagger')}
        >
          Switch to {view === 'swagger' ? 'Redoc' : 'Swagger'}
        </button>
      </div>

      {view === 'swagger' ? <SwaggerUI url="/api/docs" /> : <RedocStandalone specUrl="/api/docs" />}
    </main>
  );
}
