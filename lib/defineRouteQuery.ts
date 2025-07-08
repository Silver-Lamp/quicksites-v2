// lib/defineRouteQuery.ts
import { z, ZodObject, ZodRawShape } from 'zod';
import { useRouteQuery } from '@/hooks/useRouteQuery';
import { stringifyQueryParams } from '@/lib/stringifyQueryParams';

export function defineRouteQuery<T extends ZodRawShape>(schema: ZodObject<T>) {
  const defaultParams = schema.parse({});
  type ParamType = z.infer<typeof schema>;

  function stringify(values: Partial<ParamType>): string {
    return stringifyQueryParams(schema, values);
  }

  function getStaticParams(paramSets: Array<Partial<ParamType>>): { params: ParamType }[] {
    return paramSets.map((p) => ({ params: schema.parse(p) }));
  }

  return {
    schema,
    defaultParams,
    useQuery: () => useRouteQuery(schema),
    stringify,
    getStaticParams,
  };
}
