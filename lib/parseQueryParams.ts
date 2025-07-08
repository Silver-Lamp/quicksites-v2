// lib/parseQueryParams.ts
import { z, ZodObject, ZodRawShape } from 'zod';

type ParamSource = URLSearchParams | Record<string, string | undefined>;

function isURLSearchParams(input: ParamSource): input is URLSearchParams {
  return typeof (input as URLSearchParams).getAll === 'function';
}

function parseNestedParams(source: URLSearchParams): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of source.entries()) {
    // Handle array notation: tags[]=x
    const arrayMatch = key.match(/^(.+)\[\]$/);
    if (arrayMatch) {
      const base = arrayMatch[1];
      if (!Array.isArray(result[base])) {
        result[base] = [];
      }
      result[base].push(value);
      continue;
    }

    // Handle nested keys: filter[priceMin]
    const nestedMatch = key.match(/^([^\[\]]+)\[([^\[\]]+)\]$/);
    if (nestedMatch) {
      const [_, parent, child] = nestedMatch;
      result[parent] = {
        ...(result[parent] || {}),
        [child]: value,
      };
      continue;
    }

    // Default flat assignment
    result[key] = value;
  }

  return result;
}

export function parseQueryParams<T extends ZodRawShape>(
  schema: ZodObject<T>,
  input: ParamSource
): z.infer<ZodObject<T>> {
  let parsedInput: Record<string, any>;

  if (isURLSearchParams(input)) {
    parsedInput = parseNestedParams(input);
  } else {
    parsedInput = input;
  }

  const result = schema.safeParse(parsedInput);
  if (!result.success) {
    console.warn('[parseQueryParams] failed:', result.error.format());
    return schema.parse({});
  }

  return result.data;
}
