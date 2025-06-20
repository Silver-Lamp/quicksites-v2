import { render } from '@testing-library/react';
import TemplateSaveBar from '../components/templates/TemplateSaveBar';

it('matches snapshot', () => {
  const { asFragment } = render(
    <TemplateSaveBar jsonView={true} toggleView={() => {}} onSave={() => {}} saveStatus="idle" />
  );
  expect(asFragment()).toMatchSnapshot();
});
