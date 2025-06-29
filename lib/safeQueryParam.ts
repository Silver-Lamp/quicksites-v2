// lib/safeQueryParam.ts
export function getSafeQueryParam(
    searchParams: URLSearchParams | Record<string, string | undefined>,
    key: string,
    fallback: string = ''
  ): string {
    const value =
      typeof searchParams.get === 'function'
        ? searchParams.get(key)
        : searchParams[key];
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }
  
  export function getNumberParam(
    searchParams: URLSearchParams | Record<string, string | undefined>,
    key: string,
    fallback = 0
  ): number {
    const raw = getSafeQueryParam(searchParams, key);
    const num = parseFloat(raw);
    return isNaN(num) ? fallback : num;
  }
  