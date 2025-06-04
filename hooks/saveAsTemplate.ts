import { useCallback } from 'react';
import { createSharedPreview } from '@/admin/lib/createSharedPreview';

export async function saveAsTemplate({
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
}): Promise<string | null> {
  // simulate supabase save or other database insert
  console.log('Saving template:', {
    templateId,
    templateName,
    templateData,
    commitMessage,
    theme,
    brand,
    colorScheme,
  });

  // simulate a save with an ID return
  const resultUrl = `/templates/${templateId}?saved=true`;
  console.log('Redirect URL after save:', resultUrl);
  return templateId;
}

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
