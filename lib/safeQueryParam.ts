// lib/safeQueryParam.ts
type ParamSource = URLSearchParams | Record<string, string | undefined>;

function isURLSearchParams(
  input: ParamSource
): input is URLSearchParams {
  return typeof (input as URLSearchParams).get === 'function';
}

export function getSafeQueryParam(
  searchParams: ParamSource,
  key: string,
  fallback = ''
): string {
  const value = isURLSearchParams(searchParams)
    ? searchParams.get(key)
    : searchParams[key];

  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function getNumberParam(
  searchParams: ParamSource,
  key: string,
  fallback = 0
): number {
  const raw = getSafeQueryParam(searchParams, key);
  const num = parseFloat(raw);
  return isNaN(num) ? fallback : num;
}

export function getBooleanParam(
  searchParams: ParamSource,
  key: string,
  fallback = false
): boolean {
  const raw = getSafeQueryParam(searchParams, key).toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

export function getArrayParam(
  searchParams: ParamSource,
  key: string,
  fallback: string[] = [],
  separator: string = ','
): string[] {
  if (isURLSearchParams(searchParams)) {
    const all = searchParams.getAll(key);
    if (all.length > 0) return all;
    const commaSplit = searchParams.get(key)?.split(separator);
    return commaSplit?.filter(Boolean) || fallback;
  }

  const value = searchParams[key];
  if (typeof value === 'string') {
    return value.split(separator).filter(Boolean);
  }

  return fallback;
}
