import { useState, useEffect } from 'react';

const RADIUS_KEY = 'campaign-radius-miles';

export function useRadiusFilter(defaultRadius: number = 50) {
  const [radius, setRadius] = useState<number>(defaultRadius);

  // Load saved radius on mount
  useEffect(() => {
    const stored = localStorage.getItem(RADIUS_KEY);
    if (stored) setRadius(Number(stored));
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(RADIUS_KEY, radius.toString());
  }, [radius]);

  return { radius, setRadius };
}
