// types/grid-presets.ts
// this is for the grid block editor presets
// not for the grid map view presets

import type { Block } from '@/types/blocks';

export type GridPreset = {
  id?: string;
  name: string;
  columns: number;
  items: Block[];
  tags?: string[]; // e.g. ["hero", "cta", "testimonial"]
  description?: string; // optional short summary
  created_at?: string;
  updated_at?: string;
};

export const defaultGridPresets: GridPreset[] = [
  {
    name: 'Hero Layout',
    columns: 1,
    tags: ['hero', 'cta'],
    description: 'Large headline and CTA for onboarding',
    items: [
      {
        type: 'text',
        value: { value: 'Welcome to our product' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'button',
        value: {
          label: 'Get Started',
          href: '#',
          style: 'primary',
        },
        _id: crypto.randomUUID(),
      },
    ],
  },
  {
    name: '3-Column CTA',
    columns: 3,
    tags: ['cta', 'testimonial'],
    description: 'Three callout blocks for benefits or quotes',
    items: [
      {
        type: 'quote',
        value: { text: 'Reliable', author: 'Alex' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'quote',
        value: { text: 'Fast', author: 'Casey' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'quote',
        value: { text: 'Affordable', author: 'Jordan' },
        _id: crypto.randomUUID(),
      },
    ],
  },
  {
    name: 'Pricing Grid',
    columns: 3,
    tags: ['pricing', 'plans'],
    description: 'Compare three pricing tiers with CTAs',
    items: [
      {
        type: 'text',
        value: { value: 'Basic Plan' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'text',
        value: { value: 'Pro Plan' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'text',
        value: { value: 'Enterprise' },
        _id: crypto.randomUUID(),
      },
    ],
  },
  {
    name: 'Testimonial Wall',
    columns: 2,
    tags: ['testimonial', 'social-proof'],
    description: 'Customer quotes in a two-column layout',
    items: [
      {
        type: 'quote',
        value: { text: 'This changed my business.', author: 'Morgan' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'quote',
        value: { text: 'Support is top-notch.', author: 'Skyler' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'quote',
        value: { text: 'Super easy to use.', author: 'Jordan' },
        _id: crypto.randomUUID(),
      },
      {
        type: 'quote',
        value: { text: 'Highly recommend!', author: 'Taylor' },
        _id: crypto.randomUUID(),
      },
    ],
  },
];
