// sdk/zod-playground-client.ts
// PRIVATE SDK — not yet published

export function encodeSchema(schema: Record<string, any>): string {
    try {
      return encodeURIComponent(JSON.stringify(schema));
    } catch {
      return '';
    }
  }
  
  export function buildPlaygroundUrl(schema: Record<string, any>, base = 'https://quicksites.ai') {
    const encoded = encodeSchema(schema);
    return `${base}/admin/zod-playground?schema=${encoded}`;
  }
  
  export function openPlayground(schema: Record<string, any>, target = '_blank') {
    const url = buildPlaygroundUrl(schema);
    window.open(url, target);
  }
  
  // Future: deploySchemaToAPI, validateSchemaAgainstTemplate, etc.
  