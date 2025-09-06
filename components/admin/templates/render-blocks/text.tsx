'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';

/* ---------- helpers ---------- */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function coalesceHtmlAndText(block: any, content: any) {
  const p = (block?.props ?? {}) as any;
  const c = (content ?? block?.content ?? {}) as any;

  // Prefer explicit HTML/value first
  let html: string | undefined =
    (typeof c.html === 'string' && c.html.trim()) ||
    (typeof p.html === 'string' && p.html.trim()) ||
    (typeof c.value === 'string' && c.value.trim()) ||
    (typeof p.value === 'string' && p.value.trim());

  // Fallback: plain text → wrap in <p>, keep line breaks
  if (!html) {
    const txt =
      (typeof c.text === 'string' && c.text.trim()) ||
      (typeof p.text === 'string' && p.text.trim());
    if (txt) html = `<p>${escapeHtml(txt).replace(/\n/g, '<br/>')}</p>`;
  }

  return html || '<p></p>';
}

/* ---------- renderer ---------- */
export default function TextRender({
  block,
  content,
  colorMode = 'light',
}: {
  block: Block | any;
  content?: any;
  colorMode?: 'light' | 'dark';
}) {
  const html = coalesceHtmlAndText(block, content);
  const isDark = colorMode === 'dark';

  // Force Typography colors per site mode (so admin shell doesn’t leak styles)
  const proseVars: React.CSSProperties = isDark
    ? {
        // dark theme (light-on-dark)
        ['--tw-prose-body' as any]: 'rgb(229 231 235)',  // zinc-200
        ['--tw-prose-headings' as any]: 'rgb(255 255 255)',
        ['--tw-prose-links' as any]: 'rgb(147 197 253)', // sky-300
        ['--tw-prose-bold' as any]: 'rgb(255 255 255)',
        ['--tw-prose-quotes' as any]: 'rgb(229 231 235)',
      }
    : {
        // light theme (dark-on-light) — darker than default for better contrast
        ['--tw-prose-body' as any]: 'rgb(9 9 11)',        // zinc-950
        ['--tw-prose-headings' as any]: 'rgb(17 24 39)',  // slate-900
        ['--tw-prose-links' as any]: 'rgb(29 78 216)',    // blue-700
        ['--tw-prose-bold' as any]: 'rgb(17 24 39)',
        ['--tw-prose-quotes' as any]: 'rgb(17 24 39)',
      };

  return (
    <div
      className={['prose max-w-none', isDark ? 'prose-invert' : ''].join(' ')}
      // Body color fallback for any non-Typography children
      style={{
        color: isDark ? 'rgb(229 231 235)' : 'rgb(9 9 11)',
        ...proseVars,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
