import { useCallback } from 'react';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';

export function useSharedPreview() {
  return useCallback(
    async ({
      templateId,
      templateName,
      templateData,
      commitMessage = '',
      theme,
      brand,
      colorScheme
    }: {
      templateId: string;
      templateName: string;
      templateData: any;
      commitMessage?: string;
      theme?: string;
      brand?: string;
      colorScheme?: string;
    }): Promise<string | null> => {
      return await createSharedPreview({
        templateId,
        templateName,
        templateData,
        commitMessage,
        theme,
        brand,
        colorScheme,
      });
    },
    []
  );
}
