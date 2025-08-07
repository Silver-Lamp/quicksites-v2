// admin/lib/migrateLegacyTemplate.ts
export function migrateLegacyTemplate(template: any) {
    const migrated = { ...template };
  
    // Promote pages/services from data → top-level
    if (migrated.data?.pages && !migrated.pages) {
      migrated.pages = migrated.data.pages;
    }
  
    if (migrated.data?.services && !migrated.services) {
      migrated.services = migrated.data.services;
    }
  
    // Optional: copy meta or other nested fields if needed
    if (migrated.data?.meta && !migrated.meta) {
      migrated.meta = migrated.data.meta;
    }
  
    // Remove the legacy .data wrapper entirely
    delete migrated.data;
  
    return migrated;
  }
  