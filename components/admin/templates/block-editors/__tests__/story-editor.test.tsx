import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StoryEditor from '../story-editor';

function setup(content: any = { sections: [{ heading: 'A', body: 'a' }] }) {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <StoryEditor
      block={{ id: 'b1', type: 'story', content } as any}
      onSave={onSave}
      onClose={onClose}
      template={{} as any}
    />,
  );
  return { onSave, onClose };
}

describe('StoryEditor', () => {
  it('renders an editor row per existing section', () => {
    setup({ title: 'Why', sections: [{ heading: 'A', body: 'a' }, { heading: 'B', body: 'b' }] });
    expect(screen.getByText('Section 1')).toBeTruthy();
    expect(screen.getByText('Section 2')).toBeTruthy();
  });

  it('adds a section', () => {
    setup();
    expect(screen.queryByText('Section 2')).toBeNull();
    fireEvent.click(screen.getByText('+ Add Section'));
    expect(screen.getByText('Section 2')).toBeTruthy();
  });

  it('saves cleaned content and drops blank sections', () => {
    const { onSave } = setup({
      title: '  Our Story  ',
      sections: [
        { heading: 'Kept', body: 'has content' },
        { heading: '', body: '', image_url: '' }, // blank → dropped
      ],
    });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.content.title).toBe('Our Story');
    expect(saved.content.sections).toHaveLength(1);
    expect(saved.content.sections[0].heading).toBe('Kept');
  });

  it('falls back to a single default section if all are blank', () => {
    const { onSave } = setup({ sections: [{ heading: '', body: '' }] });
    fireEvent.click(screen.getByText('Save'));
    const saved = onSave.mock.calls[0][0];
    expect(saved.content.sections).toHaveLength(1);
    expect(saved.content.sections[0].heading).toBe('Our Story');
    expect(saved.content.title).toBeUndefined(); // no title given → omitted
  });

  it('calls onClose from Cancel', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
