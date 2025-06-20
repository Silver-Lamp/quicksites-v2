import Link from 'next/link';
import { buildSafeLink, BuildSafeLinkOptions } from '@/admin/lib/links/buildSafeLink';
import { getTemplateUrl, getSnapshotUrl } from '@/admin/lib/links/url';
import { linkThemeMap } from '@/admin/lib/links/theme';
import { MissingLink } from '@/components/admin/missing-link';

export type SmartLinkProps = {
  id?: string;
  type: 'template' | 'snapshot';
  query?: Record<string, string | number | boolean>;
  children?: React.ReactNode;
  theme?: keyof typeof linkThemeMap;
} & React.ComponentProps<typeof Link>;

export default function SmartLink({
  id,
  type,
  query,
  children,
  theme = 'primary',
  ...rest
}: SmartLinkProps) {
  const href =
    type === 'template' ? getTemplateUrl(id || '', query) : getSnapshotUrl(id || '', query);
  const className = linkThemeMap[theme] || linkThemeMap.primary;
  if (!id) {
    return <MissingLink type={type} className={className} {...(rest as any)} />;
  }

  return buildSafeLink(id, href.toString(), `${type}Link`, children, {
    className,
    ...(rest as BuildSafeLinkOptions),
  });
}
