'use client';

import { useEffect } from 'react';

/**
 * Force the site theme on /host pages even if something (e.g. next-themes)
 * tries to put `dark` back on <html> or <body>.
 */
export default function SiteThemeSetter({ mode }: { mode: 'light' | 'dark' }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const apply = () => {
      if (mode === 'dark') {
        html.classList.add('dark'); body.classList.add('dark');
        html.dataset.theme = 'dark'; body.dataset.theme = 'dark';
        (document as any).__qsTheme = 'dark';
      } else {
        html.classList.remove('dark'); body.classList.remove('dark');
        html.dataset.theme = 'light'; body.dataset.theme = 'light';
        (document as any).__qsTheme = 'light';
      }
      // Persist per domain (optional)
      try { document.cookie = `qs-site-theme=${mode}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
    };

    apply();

    // If anything flips classes again, flip them back.
    const ensure = () => {
      const wantDark = mode === 'dark';
      if (wantDark) {
        if (!html.classList.contains('dark')) html.classList.add('dark');
        if (!body.classList.contains('dark')) body.classList.add('dark');
      } else {
        if (html.classList.contains('dark')) html.classList.remove('dark');
        if (body.classList.contains('dark')) body.classList.remove('dark');
      }
    };

    const obsHtml = new MutationObserver(ensure);
    const obsBody = new MutationObserver(ensure);
    obsHtml.observe(html, { attributes: true, attributeFilter: ['class'] });
    obsBody.observe(body, { attributes: true, attributeFilter: ['class'] });

    return () => { obsHtml.disconnect(); obsBody.disconnect(); };
  }, [mode]);

  return null;
}
