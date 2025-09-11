// components/quick-sites-widget.tsx
'use client';

import { useEffect, useState } from 'react';
import PuppyWidget from './puppy-widget';
import AssistantWidget from './assistant-widget';

export type HomepageWidgetVariant = 'puppy' | 'assistant';

type Props = {
  forceVariant?: HomepageWidgetVariant; // Optional override
};

const VARIANT_KEY = 'quicksites::widget-variant';

export default function QuickSitesWidget({ forceVariant }: Props) {
  const [variant, setVariant] = useState<HomepageWidgetVariant | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (forceVariant === 'puppy' || forceVariant === 'assistant') {
      setVariant(forceVariant);
      localStorage.setItem(VARIANT_KEY, forceVariant);
      return;
    }

    const stored = localStorage.getItem(VARIANT_KEY) as HomepageWidgetVariant | null;
    if (stored === 'puppy' || stored === 'assistant') {
      setVariant(stored);
    } else {
      const chosen: HomepageWidgetVariant = Math.random() < 0.5 ? 'puppy' : 'assistant';
      localStorage.setItem(VARIANT_KEY, chosen);
      setVariant(chosen);
    }
  }, [forceVariant]);

  if (!variant) return null;

  return variant === 'puppy' ? <PuppyWidget /> : <AssistantWidget />;
}
