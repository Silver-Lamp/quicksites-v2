import type { Meta, StoryObj } from '@storybook/react';
import PresetPreviewCard from './PresetPreviewCard';
import { blockPresets } from './block-presets';

const meta: Meta<typeof PresetPreviewCard> = {
  title: 'BlockPresets/PresetPreviewCard',
  component: PresetPreviewCard,
};

export default meta;

type Story = StoryObj<typeof PresetPreviewCard>;

export const AllPresets: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {blockPresets.map((preset) => (
        <div key={preset.type}>
          <PresetPreviewCard block={preset.generate()} />
        </div>
      ))}
    </div>
  ),
};