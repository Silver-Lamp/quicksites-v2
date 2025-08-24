'use client';

import dynamic from 'next/dynamic';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import type { Template } from '@/types/template';

// Keep ssr:false if EditWrapper relies on browser-only APIs (framer-motion/useScroll/etc)
const EditWrapper = dynamic(
  () => import('@/components/admin/templates/edit-wrapper'),
  { ssr: false }
);

type Props = {
  id: string;
  /** If your Server Component already loaded the row, pass it here to avoid refetching on the client. */
  initialTemplate?: Template | null;
  /** Optional: default UI theme for the editor chrome */
  colorMode?: 'light' | 'dark';
};

export default function ClientEditorById({ id, initialTemplate, colorMode = 'light' }: Props) {
  // TemplateEditorProvider in your code expects `templateName`.
  // For ID routes, derive a stable label – prefer real name, then slug, then id.
  const derivedName =
    initialTemplate?.template_name ||
    initialTemplate?.slug ||
    id;

  return (
    <TemplateEditorProvider templateName={derivedName} colorMode={colorMode}>
      {/* EditWrapper should prefer `id` when present.
         If your current EditWrapper only accepts `slug`, update its props to accept either:
         type EditWrapperProps =
           | { id: string; initialTemplate?: Template }
           | { slug: string; initialTemplate?: Template }; */}
      <EditWrapper id={id} initialTemplate={initialTemplate ?? undefined} />
    </TemplateEditorProvider>
  );
}
