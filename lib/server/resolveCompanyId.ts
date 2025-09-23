// lib/server/resolveCompanyId.ts
export function resolveCompanyId(searchParams: URLSearchParams, body?: any) {
    return (
      body?.company_id ??
      searchParams.get('company_id') ??
      body?.org_id ??                    // ← compat: older callers
      searchParams.get('org_id') ??      // ← compat: older callers
      undefined
    ) as string | undefined;
  }
  