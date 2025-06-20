'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { logEvent } from '@/admin/utils/logEvent';

export type CelebrationModalProps = {
  type: 'badge' | 'checkin' | 'poster';
  slug: string;
  onClose: () => void;
  embedded?: boolean;
  dark?: boolean;
  autoCloseMs?: number;
  goal?: number;
  current?: number;
  ctaLabel?: string;
  ctaHref?: string;
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
  ctaLabel,
  ctaHref,
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

  const messages = {
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

  const descriptions = {
    en: {
      badge: 'You’ve hit a milestone! Keep up the great work.',
      checkin: 'Thanks for checking in today. You’re building a habit!',
      poster: 'Your campaign poster has been created. Ready to share!',
    },
    es: {
      badge: '¡Has alcanzado un hito! Sigue así.',
      checkin: 'Gracias por registrarte hoy. ¡Estás construyendo un hábito!',
      poster: 'Tu póster ha sido creado. ¡Listo para compartir!',
    },
  };

  const title = messages[lang][type];
  const description = descriptions[lang][type];

  const containerStyle = dark ? 'bg-zinc-900 text-white' : 'bg-white text-black';
  const borderStyle = dark ? 'hover:text-white text-gray-300' : 'hover:text-gray-700 text-gray-500';

  const progressBar =
    typeof goal === 'number' && typeof current === 'number' ? (
      <div className="bg-zinc-200 dark:bg-zinc-700 h-3 w-full rounded mb-4 overflow-hidden">
        <div
          className="bg-green-500 h-full transition-all"
          style={{ width: `${Math.min(100, (current / goal) * 100)}%` }}
        ></div>
      </div>
    ) : null;

  const finalHref = ctaHref || `/support/${slug}`;
  const finalLabel = ctaLabel || 'View Campaign';

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/80 flex items-center justify-center${
        embedded ? ' rounded-xl overflow-hidden shadow-2xl' : ''
      }`}
    >
      <div
        className={`relative ${containerStyle} rounded-lg shadow-xl p-6 w-full max-w-md text-center`}
      >
        <button className={`absolute top-2 right-2 ${borderStyle}`} onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        <div className="text-5xl mb-4">{title}</div>
        <p className="text-sm mb-4">{description}</p>

        {progressBar}

        <a
          href={finalHref}
          className="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {finalLabel}
        </a>
      </div>
    </div>
  );
}
