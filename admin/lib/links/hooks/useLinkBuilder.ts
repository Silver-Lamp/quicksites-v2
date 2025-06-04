import Link from 'next/link';
import { useUrlBuilder } from './useUrlBuilder';
import { buildSafeLink } from '@/admin/lib/links/buildSafeLink';

export function useLinkBuilder() {
  const { getTemplateUrl, getSnapshotUrl } = useUrlBuilder();

  const templateLink = (
    id: string,
    query?: Record<string, string | number | boolean>,
    children?: React.ReactNode,
    linkProps?: React.ComponentProps<typeof Link> & { theme?: keyof typeof linkThemeMap }
  ) => {
    const href = getTemplateUrl(id, query);
    import { linkThemeMap } from '@/admin/lib/theme';
    const resolved = linkProps?.theme && linkThemeMap[linkProps.theme] || linkThemeMap.primary;
    const { theme: _t, ...rest } = linkProps || {};
    return buildSafeLink(id, href, 'templateLink', children, { className: resolved, ...rest });
  };

  const snapshotLink = (
    id: string,
    query?: Record<string, string | number | boolean>,
    children?: React.ReactNode,
    linkProps?: React.ComponentProps<typeof Link> & { theme?: keyof typeof linkThemeMap }
  ) => {
    const href = getSnapshotUrl(id, query);
    
    const resolved = linkProps?.theme && linkThemeMap[linkProps.theme] || linkThemeMap.primary;
    const { theme: _t, ...rest } = linkProps || {};
    return buildSafeLink(id, href, 'snapshotLink', children, { className: resolved, ...rest });
  };

  return {
    templateLink,
    snapshotLink,
  };
}

