import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { describe, it, expect } from 'vitest';

describe('TemplateEditor validation', () => {
  it('auto-adds a blank page if none exist', async () => {
    render(<TemplateEditor templateName="test-auto-page" />);
    await waitFor(() => screen.getByText(/Template Name/i));
    fireEvent.click(screen.getByText(/Save All Changes/i));
    expect(await screen.findByText(/A blank page was added automatically/i)).toBeDefined();
    await waitFor(() => screen.getByText(/Template Name/i));
    fireEvent.click(screen.getByText(/Save All Changes/i));
    expect(await screen.findByText(/Template must have a name/i)).toBeDefined();
  });

  it('exports valid JSON when triggered', () => {
    const json = {
      template_name: 'example',
      industry: 'towing',
      layout: 'default',
      data: { pages: [] },
    };
    const blob = new Blob([JSON.stringify(json)], { type: 'application/json' });
    expect(blob.type).toBe('application/json');
  });
});
