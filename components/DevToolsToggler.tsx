// components/DevToolsToggler.tsx
'use client';

import { useEffect } from 'react';

export function DevToolsToggler() {
  useEffect(() => {
    const minimized = localStorage.getItem('devtools:minimized');
    if (minimized === 'true') {
      document.documentElement.classList.add('devtools-minimized');
    } else {
      document.documentElement.classList.remove('devtools-minimized');
    }
  }, []);

  return null;
}
