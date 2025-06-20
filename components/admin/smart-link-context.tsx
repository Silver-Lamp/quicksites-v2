import { createContext, useContext } from 'react';
import type { LinkTheme } from '@/admin/lib/links/theme';

export const SmartLinkContext = createContext<{
  defaultTheme?: LinkTheme;
  defaultQuery?: Record<string, string | number | boolean>;
}>({});

export function useSmartLinkTheme() {
  return useContext(SmartLinkContext);
}
