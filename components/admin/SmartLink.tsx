import Link from 'next/link';
import { buildSafeLink } from '@/admin/lib/buildSafeLink';
import { getTemplateUrl, getSnapshotUrl } from '@/admin/lib/url';
import { linkThemeMap } from '@/admin/lib/theme';
import { MissingLink } from '@/components/admin/MissingLink';

export type SmartLinkProps = {
  id?: string;
  type: 'template' | 'snapshot';
  query?: Record<string, string | number | boolean>;
  children?: React.ReactNode;
  theme?: keyof typeof linkThemeMap;
} & React.ComponentProps<typeof Link>;

export default function SmartLink({ id, type, query, children, theme = 'primary', ...rest }: SmartLinkProps) {
  const href = type === 'template' ? getTemplateUrl(id || '', query) : getSnapshotUrl(id || '', query);
  const className = linkThemeMap[theme] || linkThemeMap.primary;
  if (!id) {
    return <MissingLink type={type} className={className} {...rest} />;
  }

return buildSafeLink(id, href, `${type}Link`, children, { className, ...rest });

}
