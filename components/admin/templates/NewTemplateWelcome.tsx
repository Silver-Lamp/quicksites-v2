'use client';

import * as React from 'react';

export default function NewTemplateWelcome({
  onStart,
  title = 'Welcome to Your New Site',
  subtitle = 'Start editing, and let the magic happen.',
  cta = 'Get Started',
}: {
  onStart: () => void;
  title?: string;
  subtitle?: string;
  cta?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStart(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-neutral-900 text-white shadow-xl border border-white/10 px-6 md:px-10 py-8 md:py-10">
        <h1 className="text-3xl md:text-5xl font-bold text-center">{title}</h1>
        <p className="mt-3 md:mt-4 text-center text-neutral-300 text-base md:text-lg">
          {subtitle}
        </p>
        <div className="mt-6 md:mt-8 flex justify-center">
          <button
            className="rounded-full bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-sm md:text-base font-semibold shadow"
            onClick={onStart}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
