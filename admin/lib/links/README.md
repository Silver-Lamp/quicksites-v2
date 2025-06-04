# 🧭 SmartLink System Overview

The SmartLink system provides a consistent, theme-aware, and query-extensible way to handle navigation between templates, snapshots, and site pages in your application.

---

## 📦 Components

### `SmartLink.tsx`
Renders a styled `<Link>` with context-aware fallback behavior.
- Props: `type`, `id`, `query`, `theme`
- If `id` is missing, it shows a styled `<div>` with tooltip and logging.

### `SmartLinkGallery.tsx`
Displays a list of `SmartLink` entries with status icons.
- Icons: 💾 for `saved`, 🔗 for `shared`

### `SmartLinkDebug.tsx`
Dev-only floating panel to inspect and modify SmartLink context live.
- Toggle with `Shift+D`
- Edit theme or query directly

---

## 🧠 Context

### `SmartLinkContext.tsx`
Exposes `defaultTheme` and `defaultQuery` via React context.

### `SmartLinkProvider.tsx`
Wraps the app with `SmartLinkContext.Provider`, sourcing values from localStorage.

### `useSmartLinkPersisted.ts`
Persists and retrieves theme/query context using `localStorage`.

---

## 🧰 Utilities

### `buildSafeLink.tsx`
Gracefully renders `<Link>` or fallback `<span>` if ID is missing.

### `url.ts`
Generates `/templates/:id` and `/shared/:id` URLs with query merging.

### `theme.ts`
Defines visual themes (e.g. `primary`, `muted`, `outline`).

### `hooks/`
- `useUrlBuilder.ts`
- `useLinkBuilder.ts`
- `useSaveTemplate.ts`

---

## 🧪 Dev Usage

Wrap your layout:
```tsx
<SmartLinkProvider>
  <YourApp />
</SmartLinkProvider>
```

Debug panel (dev only):
```tsx
{process.env.NODE_ENV === 'development' && <SmartLinkDebug />}
```

---

## 🚧 Future Ideas
- `SmartLinkGrid`
- `SmartLinkTracker` (analytics)
- `SmartLinkResolver` (preview metadata)
- Test suite for link rendering and fallbacks

