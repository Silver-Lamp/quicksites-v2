import { render } from '@testing-library/react';
import TemplateHeader from '../components/templates/TemplateHeader';

it('matches snapshot', () => {
  const { asFragment } = render(
    <TemplateHeader
      name="snapshot-template"
      updatedAt="2025-05-24T20:00:00Z"
      duplicateUrl="/admin/templates-new?copy=snapshot-template"
    />
  );
  expect(asFragment()).toMatchSnapshot();
});
