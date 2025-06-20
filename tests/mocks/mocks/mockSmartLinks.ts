import type { SmartLinkItem } from '@/types/SmartLinkItem';

export const mockSmartLinks: SmartLinkItem[] = Array.from({ length: 6 }, (_, i) => ({
  id: `demo-${i + 1}`,
  type: i % 2 === 0 ? 'template' : 'snapshot',
  label: `Link ${i + 1}`,
  theme: i % 3 === 0 ? 'muted' : 'primary',
  query: i % 2 === 1 ? { shared: true } : undefined,
}));
