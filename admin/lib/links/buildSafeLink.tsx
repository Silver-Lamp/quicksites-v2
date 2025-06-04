import Link from 'next/link';

export function buildSafeLink(
  id: string | undefined,
  href: string,
  fallback: string,
  children?: React.ReactNode,
  linkProps?: React.ComponentProps<typeof Link>
) {
  if (!id) {
    console.warn(`${fallback} called with missing ID`);
    return <span className="text-red-500 italic">Missing {fallback.replace('Link', 'link')}</span>;
  }
  return <Link href={href} {...linkProps}>{children || href}</Link>;
}

