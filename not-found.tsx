// app/not-found.tsx
'use client';

import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import React from 'react';

export default function Custom404() {
  useEffect(() => {
    const log404 = async () => {
      const pathname = window.location.pathname;
      const referer = document.referrer || null;
      const userAgent = navigator.userAgent;

      await supabase.from('404_logs').insert({
        pathname,
        referer,
        user_agent: userAgent,
      });
    };

    log404();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 text-center">
      <img
        src="/images/squatbot-couch.png"
        alt="SquatBot on couch"
        className="w-64 h-auto mb-6"
      />
      <h1 className="text-3xl md:text-4xl font-bold mb-2">404: Page Not Found</h1>
      <p className="text-zinc-400 mb-6 max-w-md">
        SquatBot looked... and then sat down. This page doesn’t exist.
        <br />
        He’ll log it anyway. Just in case it matters later.
      </p>
      <a
        href="/"
        className="bg-purple-600 hover:bg-purple-500 transition px-5 py-2 rounded-full text-white font-medium"
      >
        Back to home
      </a>
      <p className="text-sm text-zinc-600 mt-6 italic">
        “Not everything needs to be squatted. Some things need to be ignored.” — SquatBot
      </p>
    </div>
  );
}
