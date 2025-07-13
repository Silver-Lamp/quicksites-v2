# 🧱 @quicksites/block-presets

Internal component library for block preset rendering and selection inside QuickSites CMS editors.

---

## ✨ Features

- Visual preview cards for each block type
- Hover-to-preview and insert-on-click selectors
- Grouped layouts by tag, with featured + recently used
- Modal or inline usage supported
- Multi-tag filtering and full accessibility support

---

## 📦 Installation

If you're in a monorepo using `pnpm` or `yarn` workspaces:

```bash
cd your-monorepo
mkdir -p packages/block-presets
# unzip unified-block-presets.zip into this folder
Or if linking manually into a local project:
# In the block-presets folder
pnpm link --global

# In your app folder
pnpm link --global @quicksites/block-presets

🔍 Exports
import {
  blockPresets,
  PresetSelector,
  PresetSelectorGrouped,
  PresetSelectorModal,
  PresetPreviewCard,
} from '@quicksites/block-presets';

📁 File Structure
block-presets/
  index.ts                      # Barrel export file
  block-presets.ts              # Block metadata, labels, tags, generate()
  preset-selector.tsx           # Tag-filterable selector grid
  preset-selector-grouped.tsx   # Sectioned layout grouped by tag
  PresetSelectorModal.tsx       # Modal wrapper with hover preview
  PresetPreviewCard.tsx         # Individual preview for a block
  PresetPreviewCard.stories.tsx # Storybook story for live demo
  package.json
  README.md

🏷️ Tags Used in Presets
| Tag            | Purpose                             |
| -------------- | ----------------------------------- |
| `content`      | Paragraphs, quotes, text blocks     |
| `action`       | CTAs, buttons, call-to-action items |
| `layout`       | Hero sections, structural elements  |
| `intro`        | First-impression sections           |
| `visual`       | Images or media                     |
| `social-proof` | Testimonials or quotes              |
