// components/features/__tests__/demoClipRow.test.tsx
//
// The clip row. Three of these pin mistakes already made once in this component's short life.

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DemoClipRow, { formatDuration, usableClips } from '@/components/features/demo-clip-row';
import { stripComments } from '@/test/stripComments';

const clip = (over: Partial<Record<string, unknown>> = {}) => ({
  src: 'https://x/demos/2026-10-01/guest-build.mp4',
  label: 'Building a site from scratch',
  blurb: 'Describe a business, watch the site appear.',
  recorded_on: '2026-10-01',
  poster: 'https://x/demos/2026-10-01/guest-build.jpg',
  duration_seconds: 28.8,
  ...over,
});

describe('formatDuration', () => {
  it('formats to m:ss', () => {
    expect(formatDuration(28.8)).toBe('0:29');
    expect(formatDuration(92)).toBe('1:32');
    expect(formatDuration(600)).toBe('10:00');
  });

  // ⚠️ Returns null, not '0:00'. An unmeasured clip must render NO pill — a "0:00" badge is a
  // measurement we never took, printed as fact.
  it('returns null when we never measured it', () => {
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
  });
});

describe('usableClips', () => {
  it('drops malformed entries and dedupes by src, keeping the FIRST', () => {
    const rich = clip();
    const stub = { src: rich.src, label: 'Walkthrough' };
    const out = usableClips([null, { label: 'no src' }, rich, stub, 'nope']);
    expect(out).toHaveLength(1);
    // ⚠️ First wins — which is why the caller must list demo_clips BEFORE the bare video_url
    // stub. Reversed, the poster-less stub beat the rich entry and the primary rendered as the
    // one grey placeholder in a row of real thumbnails. That shipped to a screenshot.
    expect(out[0].poster).toBe(rich.poster);
  });

  it('survives a non-array (the column is free-form jsonb)', () => {
    expect(usableClips({ oops: true })).toEqual([]);
    expect(usableClips(null)).toEqual([]);
  });
});

describe('<DemoClipRow>', () => {
  it('renders a card per clip with its label, blurb and duration', () => {
    render(<DemoClipRow clips={[clip()]} featureTitle="Editor" />);
    expect(screen.getByText('Building a site from scratch')).toBeInTheDocument();
    expect(screen.getByText('Describe a business, watch the site appear.')).toBeInTheDocument();
    expect(screen.getByText('0:29')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('renders nothing at all when there are no usable clips', () => {
    const { container } = render(<DemoClipRow clips={[]} featureTitle="Editor" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a labelled placeholder rather than a blank frame when a poster is missing', () => {
    render(<DemoClipRow clips={[clip({ poster: undefined })]} featureTitle="Editor" />);
    expect(screen.getByText(/walkthrough/i)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  // ⚠️ THE TRAP THIS COMPONENT EXISTS INSIDE. On /features the whole feature card is wrapped in
  // a <Link>, so a click that bubbles navigates to the detail page — which is why the inline
  // players this replaces could not actually be played.
  it('stops the click from reaching an enclosing link', () => {
    const onParentClick = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={onParentClick}>
        <DemoClipRow clips={[clip()]} featureTitle="Editor" />
      </div>,
    );
    fireEvent.click(screen.getByRole('listitem'));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('opens a dialog containing the video when a card is clicked', () => {
    render(<DemoClipRow clips={[clip()]} featureTitle="Editor" />);
    expect(document.querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('listitem'));
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', clip().src);
    expect(video).toHaveAttribute('poster', clip().poster as string);
  });
});

describe('the features page wires the row correctly (source)', () => {
  const src = stripComments(
    fs.readFileSync(path.resolve(__dirname, '../../../app/features/client-gallery.tsx'), 'utf8'),
  );

  it('lists demo_clips before the bare video_url fallback', () => {
    // ⚠️ Anchor on `]);` — the call's own end. A lazy match to the first `])` stops inside the
    // nested `: [])` of the first spread and reports the fallback as absent.
    const call = src.match(/usableClips\(\[([\s\S]*?)\]\);/);
    expect(call).not.toBeNull();
    const body = call![1];
    expect(body.indexOf('demo_clips')).toBeGreaterThan(-1);
    expect(body.indexOf('video_url')).toBeGreaterThan(-1);
    // Order is the whole fix — see usableClips above.
    expect(body.indexOf('demo_clips')).toBeLessThan(body.indexOf('video_url'));
  });
});
