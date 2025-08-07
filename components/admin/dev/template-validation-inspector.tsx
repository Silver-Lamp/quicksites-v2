'use client';

import { useEffect, useState } from 'react';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import { TemplateSaveSchema } from '@/admin/lib/zod/templateSaveSchema';

export function TemplateValidationInspector({ fullTemplateJson }: { fullTemplateJson: any }) {
  const [diagnostics, setDiagnostics] = useState<null | {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
    topLevelKeys: string[];
    nestedDataKeys: string[];
    suspicious: boolean;
  }>(null);

  const cleanForValidation = (input: any) => {
    const allowedKeys = Object.keys(TemplateSaveSchema.shape);
    const cleaned: Record<string, any> = {};

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        cleaned[key] = input[key];
      }
    }

    // Explicitly remove legacy or DB fields
    delete cleaned.created_at;
    delete cleaned.domain;
    delete cleaned.custom_domain;
    delete cleaned.data;

    return cleaned;
  };

  useEffect(() => {
    if (!fullTemplateJson) return;

    const cleaned = cleanForValidation(fullTemplateJson);
    const result = validateTemplateAndFix(cleaned);

    if (!result.valid) {
      const formErrors = result.errors?.formErrors || [];
      const fieldErrors = result.errors?.fieldErrors || {};
      const topLevelKeys = Object.keys(fullTemplateJson || {});
      const nestedDataKeys =
        fullTemplateJson?.data && typeof fullTemplateJson.data === 'object'
          ? Object.keys(fullTemplateJson.data)
          : [];

      const suspicious = !!fullTemplateJson?.data?.data;

      setDiagnostics({
        formErrors,
        fieldErrors,
        topLevelKeys,
        nestedDataKeys,
        suspicious,
      });
    } else {
      setDiagnostics(null);
    }
  }, [fullTemplateJson]);

  if (!diagnostics) return null;

  return (
    <div className="bg-red-950 text-red-200 border border-red-700 p-4 rounded text-sm max-w-4xl space-y-2">
      <div className="font-semibold text-red-300">[❌ Template Validation Inspector]</div>

      {diagnostics.suspicious && (
        <div className="text-yellow-300">
          ⚠️ Suspicious `.data.data` nesting detected. Consider unwrapping before saving.
        </div>
      )}

      <div>
        <span className="font-semibold">Top-Level Keys:</span>{' '}
        {diagnostics.topLevelKeys.join(', ') || 'N/A'}
      </div>

      <div>
        <span className="font-semibold">Nested `data` Keys:</span>{' '}
        {diagnostics.nestedDataKeys.join(', ') || 'N/A'}
      </div>

      {diagnostics.formErrors.length > 0 && (
        <div>
          <span className="font-semibold">Form Errors:</span>
          <ul className="list-disc list-inside">
            {diagnostics.formErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {Object.keys(diagnostics.fieldErrors).length > 0 && (
        <div>
          <span className="font-semibold">Field Errors:</span>
          <ul className="list-disc list-inside">
            {Object.entries(diagnostics.fieldErrors).map(([field, errors]) => (
              <li key={field}>
                <strong>{field}:</strong> {errors.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
