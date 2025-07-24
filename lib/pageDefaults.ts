// lib/pageDefaults.ts
import type { ValidatedPage } from '@/admin/lib/zod/templateSaveSchema';
import crypto from 'crypto';

export function createDefaultPage(overrides: Partial<ValidatedPage> = {}): ValidatedPage {
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
