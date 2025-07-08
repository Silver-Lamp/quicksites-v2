// components/query-link.tsx
'use client';

import Link, { LinkProps } from 'next/link';
import { stringifyQueryParams } from '@/lib/stringifyQueryParams';
import type { ZodObject, ZodRawShape, z } from 'zod';
import { ComponentProps } from 'react';

type QueryLinkProps<T extends ZodRawShape> = {
  schema: ZodObject<T>;
  pathname: string;
  params: Partial<z.infer<ZodObject<T>>>;
} & Omit<LinkProps, 'href'> &
  ComponentProps<'a'>;

export default function QueryLink<T extends ZodRawShape>({
  schema,
  pathname,
  params,
  children,
  ...rest
}: QueryLinkProps<T>) {
  const query = stringifyQueryParams(schema, params);
  const href = `${pathname}?${query}`;

  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
