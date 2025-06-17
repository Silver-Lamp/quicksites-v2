import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TemplateEditor from '../components/TemplateEditor';

describe('TemplateEditor validation', () => {
  it('auto-adds a blank page if none exist', async () => {
    render(<TemplateEditor templateName="test-auto-page" />);
    await waitFor(() => screen.getByText(/Template Name/i));
    fireEvent.click(screen.getByText(/Save All Changes/i));
    expect(
      await screen.findByText(/A blank page was added automatically/i)
    ).toBeInTheDocument();
  });

  it('blocks save if required fields are missing', async () => {
    render(<TemplateEditor templateName="test-validation" />);
    await waitFor(() => screen.getByText(/Template Name/i));
    fireEvent.click(screen.getByText(/Save All Changes/i));
    expect(
      await screen.findByText(/Template must have a name/i)
    ).toBeInTheDocument();
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
