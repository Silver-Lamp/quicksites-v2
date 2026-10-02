// The no-manifest empty state: the one screen a clip recorded before 2026-10-01 will show.

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NarrationStudio, { type StudioClip } from '@/app/admin/demo-narration/narration-studio';

const clip = (over: Partial<StudioClip> = {}): StudioClip => ({
  src: 'https://x/storage/videos/demos/2026-10-01/guest-build.mp4',
  poster: null,
  label: 'Building a site from scratch, signed out',
  recordedOn: '2026-10-01',
  manifestUrl: null,
  durationSeconds: 32.2,
  feature: 'Block-based template editor',
  ...over,
});

describe('no cue manifest', () => {
  it('explains why, and hands over a command that both records AND publishes', async () => {
    render(<NarrationStudio clips={[clip()]} />);
    await waitFor(() => expect(screen.getByText(/No cue manifest/i)).toBeInTheDocument());
    const cmd = screen.getByText(/record-demo\.mts guest-build/);
    expect(cmd.textContent).toContain('upload-demo-videos.mts --apply');
  });

  // ⚠️ guest-build leaves a real anonymous draft in the production funnel count. A CLI run makes
  // that deliberate; a copy button makes it one click, so the cost is stated beside the button.
  it('warns that this clip costs a production guest draft', async () => {
    render(<NarrationStudio clips={[clip()]} />);
    await waitFor(() => expect(screen.getByText(/anonymous draft/i)).toBeInTheDocument());
  });

  it('does not warn about a draft for clips that create none', async () => {
    render(
      <NarrationStudio
        clips={[clip({ src: 'https://x/demos/2026-10-01/finished-site.mp4', label: 'The published result' })]}
      />,
    );
    await waitFor(() => expect(screen.getByText(/No cue manifest/i)).toBeInTheDocument());
    expect(screen.queryByText(/anonymous draft/i)).toBeNull();
  });

  // ⚠️ navigator.clipboard is undefined on an insecure origin and can be denied by policy. A
  // copy button whose only failure mode is "nothing happened" is worse than no button.
  it('says so when the clipboard is blocked, and the text stays selectable either way', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    render(<NarrationStudio clips={[clip()]} />);
    await waitFor(() => expect(screen.getByText(/No cue manifest/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /copy command/i }));
    await waitFor(() => expect(screen.getByText(/Clipboard blocked/i)).toBeInTheDocument());
    expect(screen.getByText(/record-demo\.mts guest-build/)).toBeInTheDocument();
  });

  it('reminds you the poster timestamp must be re-picked', async () => {
    render(<NarrationStudio clips={[clip()]} />);
    await waitFor(() => expect(screen.getByText(/poster timestamp/i)).toBeInTheDocument());
  });
});
