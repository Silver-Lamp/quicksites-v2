import { generatePresetBlocks } from './generatePresetBlocks';
import type { PresetMap } from '@/types/blocks';

export const templatePresets: PresetMap = {
  Towing: {
    homepage: generatePresetBlocks(['hero', 'services', 'testimonial', 'cta']),
  },
  Bakery: {
    homepage: generatePresetBlocks(['hero', 'image', 'quote', 'cta']),
  },
  Agency: {
    homepage: generatePresetBlocks(['hero', 'video', 'quote', 'grid']),
  },
};
