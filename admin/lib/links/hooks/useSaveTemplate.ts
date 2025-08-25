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
      services,
    }: {
      templateId: string;
      templateName: string;
      templateData: any;
      commitMessage?: string;
      theme?: string;
      brand?: string;
      colorScheme?: string;
      services?: string[];
    }): Promise<string | null> => {
      console.log('Saving template:', {
        templateId,
        templateName,
        templateData,
        commitMessage,
        theme,
        brand,
        colorScheme,
        services,
      });
      return templateId;
    },
    []
  );
}
