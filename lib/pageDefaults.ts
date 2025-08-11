// lib/pageDefaults.ts
import type { Page } from '@/types/template';
import type { ValidatedPage } from '@/admin/lib/zod/templateSaveSchema';

// Generate a stable id in both browser and Node
const makeId = (): string => {
  try {
    // globalThis.crypto in modern runtimes
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  // Fallback
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function createDefaultPage(
  overrides: Partial<ValidatedPage> = {},
): ValidatedPage {
  return {
    id: crypto.randomUUID?.() || Date.now().toString(),
    slug: 'index',
    title: 'Sample Page',
    content_blocks: [],
    show_header: true,
    show_footer: true,
    ...overrides,
  };
}