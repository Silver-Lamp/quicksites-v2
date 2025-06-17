export function generateHero(bizName: string, vibe: string) {
  const base = {
    clean: {
      headline: `Welcome to ${bizName}`,
      subheadline: 'Professional. Reliable. Affordable.',
      cta: 'Get a Quote',
    },
    bold: {
      headline: `${bizName} Gets It Done`,
      subheadline: 'No delays. No excuses.',
      cta: 'Book Now',
    },
    warm: {
      headline: `Your neighbors at ${bizName}`,
      subheadline: 'Friendly service with a local touch.',
      cta: 'Let’s Talk',
    },
  };

  return base[vibe as keyof typeof base] || base.clean;
}
