'use client';

// Example Usage:
// {showToast && (
//   <CelebrationToast message="🎉 Goal Reached!" subtext="You're on fire." />
// )}

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

type CelebrationToastProps = {
  message: string;
  subtext?: string;
  duration?: number;
};

export function CelebrationToast({
  message,
  subtext,
  duration = 4000,
}: CelebrationToastProps) {
  useEffect(() => {
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    const audio = new Audio('/sounds/celebration.mp3');
    audio.play().catch(() => {});
    const timer = setTimeout(() => {
      const el = document.getElementById('celebration-toast');
      if (el) el.remove();
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      id="celebration-toast"
      className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg"
    >
      <p className="font-bold">{message}</p>
      {subtext && <p className="text-sm opacity-90">{subtext}</p>}
    </div>
  );
}
