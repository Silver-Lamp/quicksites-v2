// components/admin/templates/render-blocks/file-downloads.tsx
'use client';

// Downloadable copies of the document a page is about.
//
// ⚠️ THIS IS THE ARTEFACT-NOT-DEPENDENCY RULE MADE VISIBLE. A page that renders a person's résumé
// and offers no way to take it away makes every reader dependent on us staying online — and the
// reader who matters here is a hiring manager who wants a file to forward, annotate, and open in
// ten years. Same reasoning as the Verbatim profile export and the signed-agreement certificate:
// hand over a file, don't rent access to one.
//
// ⚠️ EACH LINK STATES ITS FORMAT AND SIZE. "Download" alone is a small dishonesty on a phone
// — the difference between a 10 KB Markdown file and a 70 KB PDF over a bad connection is real,
// and a person choosing a format deserves to know which one they are getting before they tap.
// Size is optional because it must be measured, never guessed.
import * as React from 'react';
import type { Block } from '@/types/blocks';
import SectionShell from '@/components/ui/section-shell';

type FileItem = { label: string; href: string; format?: string; size?: string };
type Content = { title?: string; note?: string; files?: FileItem[] };

function pick(block?: Block, override?: Block['content']): Content {
  const c = (override as Content) ?? (block?.content as Content);
  const p = (block as any)?.props as Content | undefined;
  return {
    title: c?.title ?? p?.title,
    note: c?.note ?? p?.note,
    files: (c?.files?.length ? c.files : p?.files) ?? [],
  };
}

export default function FileDownloadsRender({
  block,
  content,
  previewOnly = false,
}: {
  block?: Block;
  content?: Block['content'];
  previewOnly?: boolean;
  colorMode?: 'light' | 'dark';
}) {
  const c = pick(block, content);
  const files = (c.files ?? []).filter((f) => f?.href && f?.label);

  // Nothing configured: a hint where it can be fixed, silence where it cannot
  // (CUSTOM_SITES §4 rule 6 — editor-speak never reaches a visitor).
  if (!files.length) {
    if (previewOnly) {
      return (
        <SectionShell>
          <p className="text-sm text-muted-foreground">
            Downloads block — add a file to show a download button.
          </p>
        </SectionShell>
      );
    }
    return null;
  }

  return (
    <SectionShell>
      <div className="mx-auto max-w-2xl text-center">
        {c.title && <h2 className="text-xl font-semibold">{c.title}</h2>}
        {c.note && <p className="mt-2 text-sm opacity-70">{c.note}</p>}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {files.map((f, i) => (
            <a
              key={`${f.href}-${i}`}
              href={f.href}
              // `download` asks the browser to save rather than navigate; a PDF that opens in a
              // viewer tab is fine, a .docx that renders as gibberish in one is not.
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:border-sky-500/50"
            >
              <span>{f.label}</span>
              {f.format && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70">
                  {f.format}
                </span>
              )}
              {f.size && <span className="text-xs opacity-60">{f.size}</span>}
            </a>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
