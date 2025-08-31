// app/template/[key]/edit/ClientEditor.tsx
'use client';

import dynamic from 'next/dynamic';
import { TemplateEditorProvider } from '@/context/template-editor-context';

// If EditWrapper uses framer-motion/useScroll etc., keep ssr:false to avoid hydration issues.
const EditWrapper = dynamic(
  () => import('@/components/admin/templates/edit-wrapper'),
  { ssr: false }
);

export default function ClientEditor({ slug }: { slug: string }) {
  return (
    <TemplateEditorProvider templateName={slug} colorMode="light">
      <EditWrapper slug={slug} />
    </TemplateEditorProvider>
  );
}
