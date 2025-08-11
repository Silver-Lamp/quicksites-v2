// components/admin/dev/template-validation-inspector.tsx
'use client';

import { useEffect, useState } from 'react';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';
import { keysFromSchema, pickAllowedKeys } from '@/lib/zod/utils';

type Diagnostics = {
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
  topLevelKeys: string[];
  suspicious: boolean;
};

export function TemplateValidationInspector({
  fullTemplateJson,
}: {
  fullTemplateJson?: unknown;
}) {
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => {
    if (!fullTemplateJson || typeof fullTemplateJson !== 'object') {
      setDiag(null);
      return;
    }

    try {
      // Keep only keys allowed by the save schema (works even if wrapped in z.preprocess)
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const cleaned = pickAllowedKeys(fullTemplateJson as Record<string, unknown>, allowedKeys);

      const result = TemplateSaveSchema.safeParse(cleaned);

      if (result.success) {
        setDiag({
          formErrors: [],
          fieldErrors: {},
          topLevelKeys: Object.keys(cleaned),
          suspicious: false,
        });
      } else {
        const flat = result.error.flatten();
        setDiag({
          formErrors: flat.formErrors ?? [],
          fieldErrors: (flat.fieldErrors as Record<string, string[]>) ?? {},
          topLevelKeys: Object.keys(cleaned),
          suspicious: true,
        });
      }
    } catch {
      setDiag({
        formErrors: ['Exception while validating'],
        fieldErrors: {},
        topLevelKeys: [],
        suspicious: true,
      });
    }
  }, [fullTemplateJson]);

  if (!diag) return null;

  const hasErrors =
    diag.suspicious ||
    diag.formErrors.length > 0 ||
    Object.keys(diag.fieldErrors).length > 0;

  return (
    <div
      className={[
        'text-xs rounded px-2 py-1 border',
        hasErrors
          ? 'border-red-700 text-red-300 bg-red-950'
          : 'border-emerald-700 text-emerald-300 bg-emerald-950',
      ].join(' ')}
      title={
        hasErrors
          ? 'Schema errors detected. Hover to see details.'
          : 'Template matches TemplateSaveSchema'
      }
    >
      {hasErrors ? 'Schema errors' : 'Schema OK'}
    </div>
  );
}

export default TemplateValidationInspector;
