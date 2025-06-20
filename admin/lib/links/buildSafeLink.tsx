import Link from 'next/link';
import type { ReactNode } from 'react';

export type BuildSafeLinkOptions = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  className?: string;
  prefetch?: boolean;
  target?: '_blank' | '_self' | '_parent' | '_top';
};

export function buildSafeLink(
  id: string,
  href: string | URL,
  type: string,
  children: ReactNode,
  props: BuildSafeLinkOptions = {}
): React.ReactNode | string {
  const safeHref = typeof href === 'string' ? href : href.toString();

  return (
    <Link
      href={safeHref}
      {...props}
      data-id={id}
      data-type={type}
      prefetch={props.prefetch ?? false}
    >
      {children}
    </Link>
  );
}
