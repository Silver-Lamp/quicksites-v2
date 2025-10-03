// helpers/company.ts
export function resolveCompanyIdFromTemplate(t: any): string | null {
    // Prefer the real column when present, but fall back to legacy JSON path
    return t.company_id
        ?? t?.data?.company_id
        ?? null;
  }
  