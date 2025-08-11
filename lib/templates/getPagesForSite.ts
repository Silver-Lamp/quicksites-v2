// lib/templates/getPagesForSite.ts
import type { Template, Page } from '@/types/template';

export function getPagesForSite(site: Template): Page[] {
  return site?.data?.pages ?? [];
}
