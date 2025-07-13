export function extractFieldErrors(errors: string[]): Record<string, string> {
  const fieldMap: Record<string, string> = {};
  for (const err of errors) {
    const match = err.match(/^(.*?)\s+(is required|must|should|needs)/i);
    if (match) {
      const field = match[1].trim();
      fieldMap[field] = err;
    }
  }
  return fieldMap;
}