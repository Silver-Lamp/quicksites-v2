import type { ZodError } from 'zod';

export function printZodErrors(error: ZodError<any>, label = '❌ Zod Validation Error') {
  const { fieldErrors, formErrors } = error.flatten();

  console.groupCollapsed(label);
  console.log('Form Errors:', formErrors);
  console.log('Field Errors:');
  for (const [key, value] of Object.entries(fieldErrors)) {
    console.log(`  ${key}:`, value);
  }
  console.groupEnd();
}
