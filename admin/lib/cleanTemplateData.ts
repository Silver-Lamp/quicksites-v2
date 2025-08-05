// admin/lib/cleanTemplateData.ts
export function unwrapData<T = any>(obj: any): T {
    let current = obj;
    let depth = 0;
    while (current?.data && depth < 10) {
      current = current.data;
      depth++;
    }
    return current;
  }
  
  export function cleanTemplateDataStructure(raw: any) {
    const unwrapped = unwrapData(raw.data || {});
    return {
      ...unwrapped,
      pages: Array.isArray(unwrapped.pages) ? unwrapped.pages : [],
      services: Array.isArray(unwrapped.services) ? unwrapped.services : [],
    };
  }
  