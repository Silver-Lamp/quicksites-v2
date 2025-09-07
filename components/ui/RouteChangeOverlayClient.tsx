'use client';

import { useEffect, useRef, useState } from 'react';
import LoadingSplash from './LoadingSplash';
import Router from 'next/router';

type Props = {
  showDelayMs?: number;     // don’t show if it finishes quickly
  minVisibleMs?: number;    // keep visible long enough to avoid a flash
};

export default function RouteChangeOverlayClient({
  showDelayMs = 120,
  minVisibleMs = 300,
}: Props) {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<number | null>(null);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    const start = () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, showDelayMs);
    };

    const done = () => {
      if (showTimer.current) {
        window.clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      if (!visible) return; // never shown
      const elapsed = shownAt.current ? Date.now() - shownAt.current : 0;
      const left = Math.max(minVisibleMs - elapsed, 0);
      window.setTimeout(() => setVisible(false), left);
    };

    Router.events.on('routeChangeStart', start);
    Router.events.on('routeChangeComplete', done);
    Router.events.on('routeChangeError', done);
    return () => {
      Router.events.off('routeChangeStart', start);
      Router.events.off('routeChangeComplete', done);
      Router.events.off('routeChangeError', done);
    };
  }, [showDelayMs, minVisibleMs, visible]);

  if (!visible) return null;
  return <LoadingSplash />;
}
