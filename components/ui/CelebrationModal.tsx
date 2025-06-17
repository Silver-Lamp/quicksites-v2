'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { logEvent } from '../../utils/logEvent.js';

export type CelebrationModalProps = {
  type: 'badge' | 'checkin' | 'poster';
  slug: string;
  onClose: () => void;
  embedded?: boolean;
  dark?: boolean;
  autoCloseMs?: number;
  goal?: number;
  current?: number;
};

export function CelebrationModal({
  type,
  slug,
  onClose,
  embedded = false,
  dark = false,
  autoCloseMs,
  goal,
  current,
}: CelebrationModalProps) {
  useEffect(() => {
    const sounds: Record<string, string> = {
      badge: '/sounds/celebration/crowd-cheers-314921.mp3',
      checkin: '/sounds/celebration/pop.mp3',
      poster: '/sounds/celebration/shutter.mp3',
    };

    confetti({
      particleCount: 120,
      spread: type === 'poster' ? 70 : 100,
      origin: { y: 0.6 },
      colors: type === 'poster' ? ['#1D4ED8', '#6EE7B7', '#F59E0B'] : undefined,
    });

    const audio = new Audio(sounds[type] || sounds.badge);
    audio.play().catch(() => {});

    logEvent(`celebration_${type}`, {
      slug,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    let timeout: NodeJS.Timeout | undefined;
    if (autoCloseMs) {
      timeout = setTimeout(onClose, autoCloseMs);
    }

    return () => {
      audio.pause();
      if (timeout) clearTimeout(timeout);
    };
  }, [type, slug, onClose, autoCloseMs]);

  const locale = typeof window !== 'undefined' ? navigator.language : 'en';
  const lang = locale.startsWith('es') ? 'es' : 'en';

  const localizedMessages: Record<string, Record<string, string>> = {
    en: {
      badge: '🏅 Badge Earned!',
      checkin: '✅ Check-in Complete!',
      poster: '📸 Poster Ready!',
    },
    es: {
      badge: '🏅 ¡Insignia obtenida!',
      checkin: '✅ ¡Registro completo!',
      poster: '📸 ¡Póster listo!',
    },
  };

  const localizedDescriptions: Record<string, Record<string, string>> = {
    en: {
      badge: 'You’ve hit a milestone! Keep up the great work.',
      checkin: 'Thanks for checking in today. You’re building a habit!',
      poster: 'Your campaign poster has been created. Ready to share!',
    },
    es: {
      badge: '¡Has alcanzado un hito! Sigue así.',
      checkin: 'Gracias por registrarte hoy. ¡Estás construyendo un hábito!',
      poster: 'Tu póster de campaña ha sido creado. ¡Listo para compartir!',
    },
  };

  const title = localizedMessages[lang][type];
  const description = localizedDescriptions[lang][type];
  const containerStyle = dark
    ? 'bg-zinc-900 text-white'
    : 'bg-white text-black';
  const borderStyle = dark
    ? 'hover:text-white text-gray-300'
    : 'hover:text-gray-700 text-gray-500';
  const progress =
    goal && current ? Math.min(100, Math.round((current / goal) * 100)) : null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 flex items-center justify-center${embedded ? ' rounded-xl overflow-hidden shadow-2xl' : ''}`}
    >
      <div
        className={`relative ${containerStyle} rounded-lg shadow-xl p-6 w-full max-w-md text-center`}
      >
        <button
          className={`absolute top-2 right-2 ${borderStyle}`}
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-5xl mb-4">{title}</div>
        <p className="text-sm mb-6">{description}</p>

        {progress !== null && (
          <div className="mb-4 text-left">
            <p className="text-xs mb-1">
              Progress: {current} / {goal}
            </p>
            <div className="w-full bg-zinc-300 dark:bg-zinc-700 rounded h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <a
          href={`/support/${slug}`}
          className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View Campaign
        </a>
      </div>
    </div>
  );
}
