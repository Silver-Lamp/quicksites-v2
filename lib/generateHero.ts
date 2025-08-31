// lib/generateHero.ts
import type { SeedContext, Block } from '@/types/blocks';
import { makeDefaultBlock, validateBlock } from '@/lib/blockRegistry.core';

export type HeroVibe = 'clean' | 'bold' | 'warm';

export type HeroCopy = {
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref?: string;
};

/** Copy presets shaped to the canonical hero props */
export function generateHeroCopy(bizName: string, vibe: HeroVibe = 'clean'): HeroCopy {
  const name = bizName?.trim() || 'Our Company';
  const map: Record<HeroVibe, HeroCopy> = {
    clean: {
      heading: `Welcome to ${name}`,
      subheading: 'Professional. Reliable. Affordable.',
      ctaLabel: 'Get a Quote',
      ctaHref: '#services',
    },
    bold: {
      heading: `${name} Gets It Done`,
      subheading: 'No delays. No excuses.',
      ctaLabel: 'Book Now',
      ctaHref: '#services',
    },
    warm: {
      heading: `Your neighbors at ${name}`,
      subheading: 'Friendly service with a local touch.',
      ctaLabel: 'Let’s Talk',
      ctaHref: '#services',
    },
  };
  return map[vibe] || map.clean;
}

/**
 * Optional: build a complete hero block using the Blocks API,
 * then overlay the vibe-specific copy.
 */
export function generateHeroBlock(
  bizName: string,
  vibe: HeroVibe = 'clean',
  ctx: Partial<SeedContext> = {}
): Block {
  const base = generateHeroCopy(bizName, vibe);
  const block = makeDefaultBlock('hero', {
    ...ctx,
    merchant: { ...(ctx.merchant ?? {}), name: bizName || ctx.merchant?.name || 'Demo' },
  }) as Block;

  const merged: Block = {
    ...block,
    props: {
      ...(block.props as any),
      heading: base.heading,
      subheading: base.subheading,
      ctaLabel: base.ctaLabel,
      ctaHref: base.ctaHref ?? (block as any)?.props?.ctaHref ?? '#services',
    },
  };

  const v = validateBlock(merged);
  return v.ok ? v.value : merged;
}
