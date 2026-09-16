/**
 * @jest-environment jsdom
 */
// components/admin/templates/__tests__/editorPreviewButton.test.tsx
//
// The editor's top bar has a Preview button that opens the watermarked draft. Before it, the
// only way to see an unpublished draft as a visitor would was a copy-the-link line in the guest
// banner — signed-in owners had Save, Save & Publish, Archive, and no way to LOOK. Both public
// routes 404 for an unpublished draft (verified on hicustom-5gsc8, 2026-09-16), so the button
// must target /preview?template_id=, not the site URL.

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/templates/0ff856f3-3574-4176-9d00-336ba55314b3',
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

import {
  TemplateEditorToolbar,
  draftPreviewUrl,
  extractTemplateIdFromPath,
} from '@/components/admin/templates/template-editor-toolbar';

describe('extractTemplateIdFromPath', () => {
  // The editor route is /admin/templates/<id> (plural). The helper only knew the singular, so
  // on the real route the id was null: Archive toasted "Missing template id" and the display
  // name never resolved from the server.
  it('reads the id from the real editor route (plural segment)', () => {
    expect(extractTemplateIdFromPath('/admin/templates/0ff856f3-3574-4176-9d00-336ba55314b3')).toBe(
      '0ff856f3-3574-4176-9d00-336ba55314b3',
    );
  });
  it('still accepts the singular segment', () => {
    expect(extractTemplateIdFromPath('/admin/template/abc')).toBe('abc');
  });
  it('returns null for the list / new pages that share the prefix', () => {
    expect(extractTemplateIdFromPath('/admin/templates/list')).toBeNull();
    expect(extractTemplateIdFromPath('/admin/templates/new')).toBeNull();
    expect(extractTemplateIdFromPath(null)).toBeNull();
  });
});

const baseProps = {
  templateName: '指纹科技HICUSTOM',
  isRenaming: false,
  setIsRenaming: () => {},
  inputValue: '',
  setInputValue: () => {},
  handleRename: () => {},
};

beforeAll(() => {
  // The toolbar resolves its display name over fetch on mount; keep it offline.
  (global as any).fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
});

describe('draftPreviewUrl', () => {
  it('targets the explicit-id preview route, which renders unpublished drafts', () => {
    expect(draftPreviewUrl('abc')).toBe('/preview?template_id=abc');
  });
  it('never points at the public site URL (404 for a draft)', () => {
    expect(draftPreviewUrl('abc')).not.toMatch(/\/sites\/|quicksites\.ai/);
  });
});

describe('TemplateEditorToolbar Preview button', () => {
  it('renders a Preview button that calls onPreview', () => {
    const onPreview = jest.fn();
    render(<TemplateEditorToolbar {...baseProps} onPreview={onPreview} />);
    const btn = screen.getByRole('button', { name: /preview/i });
    fireEvent.click(btn);
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('is disabled and says Opening… while the save-before-preview runs', () => {
    render(<TemplateEditorToolbar {...baseProps} onPreview={() => {}} previewBusy />);
    const btn = screen.getByRole('button', { name: /opening/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('is absent when no handler is supplied (read-only mounts)', () => {
    render(<TemplateEditorToolbar {...baseProps} />);
    expect(screen.queryByRole('button', { name: /preview/i })).toBeNull();
  });

  it('no longer prints the non-existent /templates/<slug> route as the preview URL', () => {
    render(<TemplateEditorToolbar {...baseProps} isRenaming slugPreview="hicustom-5gsc8" />);
    expect(document.body.textContent).not.toContain('/templates/hicustom-5gsc8');
    expect(document.body.textContent).toContain('/preview?template_id=0ff856f3-3574-4176-9d00-336ba55314b3');
  });
});

describe('the editor wires the button to a save-first handler', () => {
  const src = readFileSync(join(process.cwd(), 'components/admin/templates/template-editor.tsx'), 'utf8');

  it('passes onPreview to the toolbar', () => {
    expect(src).toMatch(/onPreview=\{handlePreview\}/);
  });

  it('opens the tab synchronously in the click handler, before any await (pop-up blockers)', () => {
    const at = src.indexOf('const handlePreview = ');
    const body = src.slice(at, src.indexOf('const handleCleanSaveDraft'));
    const openAt = body.indexOf("window.open('about:blank'");
    const awaitAt = body.indexOf('await commitNow');
    expect(openAt).toBeGreaterThan(-1);
    expect(awaitAt).toBeGreaterThan(openAt);
  });

  it('saves the current draft before pointing the tab at the preview', () => {
    const at = src.indexOf('const handlePreview = ');
    const body = src.slice(at, src.indexOf('const handleCleanSaveDraft'));
    expect(body).toContain('await commitNow(id, (template as any).data)');
    expect(body).toContain('draftPreviewUrl(id)');
  });
});
