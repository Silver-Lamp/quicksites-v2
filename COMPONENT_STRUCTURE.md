# 📁 QuickSites Studio Component Structure Guide

This guide explains where components should live in the QuickSites codebase to maintain clarity, reusability, and modularity.

---

## 🔲 components/

Used for global layout, nav, shell UI, or any non-domain-specific components.

- `AppHeader.tsx` → Main top nav
- `SidebarLayout.tsx` → Shell for admin pages
- `Breadcrumbs.tsx`, `ThemeToggle.tsx`, `CommandPalette.tsx` → Shared UI utilities

---

## 🧩 components/ui/

Low-level UI primitives (styled atoms, used everywhere).

- `Input.tsx`, `Button.tsx`, `Dialog.tsx`, `Tabs.tsx` etc.
- Headless or shadcn-style building blocks

---

## 🧠 components/branding/

All things related to branding profiles.

- `BrandingPreview.tsx` → Shows theme/brand
- `BrandingBadge.tsx` → Inline badge in list views
- `BrandingAuditPanel.tsx` → Change history
- `ThemeBrandSwitcherAdvanced.tsx` → Profile theme/brand toggle
- `TemplatePublishModal.tsx` → Modal for launching new sites

---

## 🧱 components/templates/

Template-specific editors and tools

- `TemplateEditor.tsx` → Main editor
- `TemplatePreview.tsx`, `TemplateJsonEditor.tsx`, `BlockEditor.tsx` → Sub-editors
- `ReorderableBlockList.tsx` → Page/block order logic

---

## 🧪 components/og/

Visual tools for generating OG preview cards

- `WysiwygPreview.tsx`
- `renderOgImage.ts`
- Any components used in `/api/og/snapshot`

---

## 🔁 components/layout/

Reusable layout scaffolds

- `AdminSidebarLayout.tsx`
- `PublicLayout.tsx` (if needed)

---

## 🧪 Testing

- `__tests__/` for unit or visual tests
- `__stories__/` for Storybook

---

Questions? Open a doc issue or ping the steward.
