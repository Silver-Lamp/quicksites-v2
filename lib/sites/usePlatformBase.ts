'use client';

// The platform base (`/sites/<slug>`) of the page we are mounted on, or ''. Read after mount so
// the server render stays identical on every host; the hrefs update once on the client.
import * as React from 'react';
import { platformBaseFromPathname } from '@/lib/sites/platformBase';

export function usePlatformBase(): string {
  const [base, setBase] = React.useState('');
  React.useEffect(() => {
    try {
      setBase(platformBaseFromPathname(window.location.pathname));
    } catch {
      /* no window */
    }
  }, []);
  return base;
}
