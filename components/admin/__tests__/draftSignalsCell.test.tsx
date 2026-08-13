/**
 * @jest-environment jsdom
 */
// The Notable cell, rendered.
//
// ⚠️ WRITTEN BECAUSE I HAD NOT LOOKED AT IT. The cell was wired, typechecked and shipped without
// anyone seeing it render — the exact gap this repo keeps paying for (a settings panel whose button
// existed in a file nothing imported; a portal whose blocks were written to the array nobody
// renders). `/admin/outreach` is admin-gated, so a browser check needs a session; rendering the
// component asserts the same thing the eye would: what does a person actually see.
import { render, screen, fireEvent } from '@testing-library/react';
import DraftSignalsCell from '../draft-signals-cell';
import type { Signal } from '@/lib/outreach/draftSignals';

const defect: Signal = {
  kind: 'no_prices',
  severity: 'defect',
  label: 'No prices came through',
  detail: 'All 28 items parsed without a price — the page shows "call to confirm" throughout.',
};
const note: Signal = {
  kind: 'hours_missing_days',
  severity: 'note',
  label: 'Hours omit mon',
  detail: 'Absent is not the same as closed — ask, do not assume.',
};

describe('DraftSignalsCell', () => {
  it('renders a dash for a clean draft rather than empty space', () => {
    const { container } = render(<DraftSignalsCell signals={[]} />);
    expect(container.textContent).toContain('—');
  });

  it('survives the prop being absent entirely', () => {
    const { container } = render(<DraftSignalsCell />);
    expect(container.textContent).toContain('—');
  });

  it('summarises defects and notes separately', () => {
    render(<DraftSignalsCell signals={[defect, note]} />);
    expect(screen.getByRole('button').textContent).toContain('1 to fix');
    expect(screen.getByRole('button').textContent).toContain('1 notable');
  });

  // ⚠️ The detail is HIDDEN until asked for. 162 drafts × several signals rendered inline would
  // bury the table it is meant to inform.
  it('keeps the detail collapsed until clicked', () => {
    render(<DraftSignalsCell signals={[defect]} />);
    expect(screen.queryByText(/All 28 items parsed/)).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/All 28 items parsed/)).toBeTruthy();
  });

  it('shows the label and the evidence once expanded', () => {
    render(<DraftSignalsCell signals={[defect]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/No prices came through/)).toBeTruthy();
    expect(screen.getByText(/call to confirm/)).toBeTruthy();
  });

  // ⚠️ The reminder is the whole point of the panel existing rather than a copy generator.
  it('tells the reader these are observations, not copy', () => {
    render(<DraftSignalsCell signals={[defect]} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Observations, not copy/)).toBeTruthy();
  });

  it('reads as notable-only when nothing is broken', () => {
    render(<DraftSignalsCell signals={[note]} />);
    const label = screen.getByRole('button').textContent ?? '';
    expect(label).toContain('1 notable');
    expect(label).not.toContain('to fix');
  });
});

describe('it is wired into the table an operator actually opens', () => {
  // A component nobody renders is the failure this repo has shipped twice. Assert the call site.
  const src = require('node:fs').readFileSync(
    require('node:path').join(process.cwd(), 'components/admin/outreach-pipeline.tsx'),
    'utf8',
  );

  it('is imported and rendered by the outreach pipeline', () => {
    expect(src).toMatch(/import DraftSignalsCell/);
    expect(src).toMatch(/<DraftSignalsCell signals=\{r\.signals\}/);
  });

  it('has a column header, so the cell is not an unlabelled box', () => {
    expect(src).toContain('<th>Notable</th>');
  });

  it('is fed by the loader rather than computed in the client', () => {
    const loader = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'lib/outreach/growthData.ts'),
      'utf8',
    );
    expect(loader).toMatch(/signals: sortSignals\(detectSignals\(r\.data\)\)/);
  });
});
