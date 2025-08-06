// lib/blocks/describeZodField.ts
import { z, ZodTypeAny } from 'zod';

export function describeZodField(field: ZodTypeAny): string {
  const typeName = field._def?.typeName ?? 'unknown';
  const checks = field._def?.checks ?? [];
  const isOptional = !!field._def?.optional;
  const notes: string[] = [];

  switch (typeName) {
    case 'ZodString':
      notes.push('string');
      if (checks.some((c: any) => c.kind === 'min')) {
        const min = checks.find((c: any) => c.kind === 'min')?.value;
        notes.push(`min ${min}`);
      }
      if (checks.some((c: any) => c.kind === 'email')) notes.push('email');
      if (checks.some((c: any) => c.kind === 'url')) notes.push('url');
      break;
    case 'ZodNumber':
      notes.push('number');
      break;
    case 'ZodBoolean':
      notes.push('boolean');
      break;
    case 'ZodArray':
      notes.push('array');
      break;
    case 'ZodObject':
      notes.push('object');
      break;
    default:
      notes.push(typeName.replace(/^Zod/, '').toLowerCase());
  }

  if (isOptional) notes.push('optional');
  else notes.push('required');

  return notes.join(' ');
}
