import { useCallback } from 'react';

export function useSaveTemplate() {
  return useCallback(
    async ({
      templateId,
      templateName,
      templateData,
      commitMessage = '',
      theme,
      brand,
      colorScheme,
    }: {
      templateId: string;
      templateName: string;
      templateData: any;
      commitMessage?: string;
      theme?: string;
      brand?: string;
      colorScheme?: string;
    }): Promise<string | null> => {
      console.log('Saving template:', {
        templateId,
        templateName,
        templateData,
        commitMessage,
        theme,
        brand,
        colorScheme,
      });
      return templateId;
    },
    []
  );
}
