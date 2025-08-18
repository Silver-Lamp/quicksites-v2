import Link from 'next/link';
import { useUrlBuilder } from './useUrlBuilder';
import { buildSafeLink } from '../buildSafeLink';
import { linkThemeMap } from '../theme';
import type { ReactNode } from 'react';

type LinkProps = React.ComponentProps<typeof Link> & {
  theme?: keyof typeof linkThemeMap;
};

export function useLinkBuilder() {
  const { getTemplateUrl, getSnapshotUrl } = useUrlBuilder();

  const templateLink = (
    id: string,
    query?: Record<string, string | number | boolean>,
    children?: ReactNode,
    linkProps?: LinkProps
  ) => {
    const href = getTemplateUrl(id, query);
    if (!href) return null;

    const resolved = linkProps?.theme ? linkThemeMap[linkProps.theme] : linkThemeMap.primary;

    const { theme: _t, href: _h, prefetch: _p, target: _tg, ...rest } = linkProps || {};
    const target = _tg as '_blank' | '_self' | '_parent' | '_top' | undefined;
    return buildSafeLink(id, href.toString(), 'templateLink', children, {
      className: resolved,
      prefetch: _p === 'auto' ? undefined : _p ?? undefined,
      target,
      ...rest,
    });
  };

  const snapshotLink = (
    id: string,
    query?: Record<string, string | number | boolean>,
    children?: ReactNode,
    linkProps?: LinkProps
  ) => {
    const href = getSnapshotUrl(id, query);
    if (!href) return null;

    const resolved = linkProps?.theme ? linkThemeMap[linkProps.theme] : linkThemeMap.primary;

    const { theme: _t, href: _h, prefetch: _p, ...rest } = linkProps || {};
    return buildSafeLink(id, href.toString(), 'snapshotLink', children, {
      className: resolved,
      prefetch: _p === 'auto' ? undefined : _p ?? undefined,
      target: undefined as any,
      ...rest,
    });
  };

  return {
    templateLink,
    snapshotLink,
  };
}
