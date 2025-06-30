// lib/utils/safeParse.ts
export function safeParse<T = unknown>(value: string | undefined): T | string | undefined {
    if (!value) return undefined;
  
    // Avoid parsing base64 or JWT-style tokens
    if (
      value.startsWith('base64-') ||
      /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)
    ) {
      return value;
    }
  
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  