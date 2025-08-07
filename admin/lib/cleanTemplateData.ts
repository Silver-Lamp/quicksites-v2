// admin/lib/cleanTemplateData.ts
export function unwrapData<T = any>(obj: any): T {
    let current = obj;
    let depth = 0;
    while (current?.data && typeof current.data === 'object' && depth < 10) {
      current = current.data;
      depth++;
    }
    return current;
  }
  
  export function cleanTemplateDataStructure(raw: any) {
    const { data, ...rest } = raw || {};
    return {
      ...rest,
      pages: Array.isArray(raw.pages) ? raw.pages : [],
      services: Array.isArray(raw.services) ? raw.services : [],
    };
  }
  