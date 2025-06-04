// lib/schemaStorage.ts

export function saveSchema(name: string, json: string) {
    localStorage.setItem(`schema:${name}`, json);
  }
  
  export function loadSchema(name: string): string | null {
    return localStorage.getItem(`schema:${name}`);
  }
  
  export function deleteSchema(name: string) {
    localStorage.removeItem(`schema:${name}`);
  }
  
  export function listSchemas(): string[] {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith('schema:'))
      .map((k) => k.replace('schema:', ''));
  }
  