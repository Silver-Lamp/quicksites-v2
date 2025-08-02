// lib/templates/getPagesForSite.ts
import type { Template } from '@/types/template';

export function getPagesForSite(site: Template): Template['data']['pages'] {
  return Array.isArray(site?.data?.pages) ? site.data.pages : [];
}
