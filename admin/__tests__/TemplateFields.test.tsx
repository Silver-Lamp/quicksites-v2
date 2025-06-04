import { render } from '@testing-library/react';
import TemplateFields from '../components/templates/TemplateFields';

it('matches snapshot', () => {
  const { asFragment } = render(
    <TemplateFields
      industry="towing"
      layout="default"
      color_scheme="blue-yellow"
      commitMessage="Snapshot test"
      onChange={() => {}}
    />
  );
  expect(asFragment()).toMatchSnapshot();
});
