import { render } from '@testing-library/react';
import TemplateJsonEditor from '../components/templates/TemplateJsonEditor';

it('matches snapshot', () => {
  const { asFragment } = render(
    <TemplateJsonEditor rawJson='{"pages":[]}' setRawJson={() => {}} />
  );
  expect(asFragment()).toMatchSnapshot();
});
