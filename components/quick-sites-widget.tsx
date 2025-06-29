'use client';

import { useEffect, useState } from 'react';
import PuppyWidget from './puppy-widget';
import AssistantWidget from './assistant-widget';

type Variant = 'puppy' | 'assistant';

type Props = {
  forceVariant?: Variant; // Optional override
};

const VARIANT_KEY = 'quicksites::widget-variant';

export default function QuickSitesWidget({ forceVariant }: Props) {
  const [variant, setVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (forceVariant === 'puppy' || forceVariant === 'assistant') {
      setVariant(forceVariant);
      localStorage.setItem(VARIANT_KEY, forceVariant);
      return;
    }

    const stored = localStorage.getItem(VARIANT_KEY) as Variant | null;
    if (stored === 'puppy' || stored === 'assistant') {
      setVariant(stored);
    } else {
      const chosen: Variant = Math.random() < 0.5 ? 'puppy' : 'assistant';
      localStorage.setItem(VARIANT_KEY, chosen);
      setVariant(chosen);
    }
  }, [forceVariant]);

  if (!variant) return null;

  return variant === 'puppy' ? <PuppyWidget /> : <AssistantWidget />;
}
