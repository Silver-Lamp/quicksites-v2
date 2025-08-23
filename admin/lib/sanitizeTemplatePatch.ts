// admin/lib/sanitizeTemplatePatch.ts
export function sanitizeTemplatePatch(raw: any) {
    const out: any = {};
  
    const emptyToNull = (v: any) => {
      if (v == null) return null;
      const s = String(v).trim();
      return s === '' ? null : s;
    };
  
    const numberOrNull = (v: any) => {
      if (v === '' || v == null) return null;
      const n = typeof v === 'number' ? v : Number(String(v));
      return Number.isFinite(n) ? n : null;
    };
  
    const digitsOrNull = (v: any) => {
      const s = String(v ?? '').replace(/\D/g, '');
      return s.length ? s : null;
      // if you want to *keep* formatting, remove this and use emptyToNull instead
    };
  
    // Copy only defined keys
    for (const k of Object.keys(raw || {})) {
      const v = (raw as any)[k];
      if (v !== undefined) out[k] = v;
    }
  
    // Coerce/trim DB-backed fields
    out.business_name = emptyToNull(out.business_name);
    out.contact_email = emptyToNull(out.contact_email);
  
    out.address_line1 = emptyToNull(out.address_line1);
    out.address_line2 = emptyToNull(out.address_line2);
    out.city          = emptyToNull(out.city);
    out.state         = emptyToNull(out.state);
    out.postal_code   = emptyToNull(out.postal_code);
  
    out.latitude  = numberOrNull(out.latitude);
    out.longitude = numberOrNull(out.longitude);
  
    out.phone = digitsOrNull(out.phone);
  
    if (Array.isArray(out.services)) {
      out.services = Array.from(
        new Set(out.services.map((s: any) => String(s ?? '').trim()).filter(Boolean))
      );
    }
  
    // Optional: drop keys that are still undefined (PG prefers nulls to empty strings)
    for (const k of Object.keys(out)) {
      if (out[k] === undefined) delete out[k];
    }
  
    return out;
  }
  