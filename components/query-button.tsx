'use client';

import { useRouter } from 'next/navigation';
import { stringifyQueryParams } from '@/lib/stringifyQueryParams';
import type { ZodObject, ZodRawShape, z } from 'zod';
import type { ButtonHTMLAttributes } from 'react';

type QueryButtonProps<T extends ZodRawShape> = {
  schema: ZodObject<T>;
  pathname: string;
  params: Partial<z.infer<ZodObject<T>>>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function QueryButton<T extends ZodRawShape>({
  schema,
  pathname,
  params,
  children,
  ...rest
}: QueryButtonProps<T>) {
  const router = useRouter();

  const handleClick = () => {
    const query = stringifyQueryParams(schema, params);
    const href = `${pathname}?${query}`;
    router.push(href);
  };

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}
