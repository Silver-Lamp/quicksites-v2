# 🌈 GoodRobot Branding System

This bundle enables a fully modular branding system across your admin dashboard, template editor, and OG rendering layer.

---

## 📸 Visual Flow

```
[Branding Profiles Table] ─┐
                           │
[Editor Dropdown + Suggestion] → [Snapshot Save → branding_profile_id]
                           │
             [OG Renderer fetches profile] → [Themed Image Response]
                           │
        [Admin UI: create/edit/delete + preview]
```

---

## ✨ Components Overview

| Component           | Description                               |
| ------------------- | ----------------------------------------- |
| `branding_profiles` | Supabase table with theme/brand/logo info |
| `TemplateEditor`    | Dropdown + preview + auto-suggest         |
| `/api/share`        | Attaches branding_profile_id to snapshot  |
| `/api/og/snapshot`  | Dynamically styled OG preview             |
| `/admin/branding`   | Full UI to manage branding profiles       |
| `BrandingBadge.tsx` | Dashboard badge for each template         |

---

## 🧠 Naming Strategy

Branding profiles should include keywords in their name (e.g., `Towing Pro Dark`) to allow auto-suggestions to work by industry/layout.

---
