import { render } from '@testing-library/react';
import TemplateSaveBar from '@/components/admin/templates/template-save-bar';
import { describe, it, expect } from 'vitest';

// describe('TemplateSaveBar', () => {
//   it('matches snapshot', () => {
//   const { asFragment } = render(
//     <TemplateSaveBar
//       template={{
//         industry: 'towing',
//         layout: 'default',
//         color_scheme: 'blue-yellow',
//         data: { pages: [] },
//         name: 'test',
//         theme: 'default',
//         brand: 'default'
//       }}
//       rawJson={JSON.stringify({})}
//       commitMessage={'test'}
//     />
//   );
//   expect(asFragment()).toMatchSnapshot();
// });
