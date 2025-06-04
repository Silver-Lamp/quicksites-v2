# Zod Playground Strategy – QuickSites Confidential

## 🎯 Core Purpose

Enable schema-driven, low-code site creation powered by Zod. The system supports visual editing, live preview, shortlinks, Supabase sync, and programmable deploys — all within a private, modular Next.js framework.

## 🧱 Architecture Summary

* **Editor**: JSON + VisualSchema with live Zod-to-site rendering
* **Preview**: QueryParamEditor + /launch interface
* **Storage**: Supabase (schema\_links, saved\_schemas)
* **Share**: Long query param links or short `schema_id` links
* **Security**: All admin routes gated by auth and role

## 🔐 Intellectual Property

The full core codebase is **proprietary** and protected:

* Internal components like `QueryParamEditor`, `VisualSchema`, `PresetCard`, etc. are not open-sourced.
* Supabase backend logic and admin controls remain private.

## 🪄 What We Expose Publicly

### 1. **Minimal GitHub Template (MIT)**

* Starter UI, README, and defaultSchema.ts
* No backend logic
* Promotes hosted version at `https://quicksites.ai/admin/zod-playground`

### 2. **Hosted Playground**

* Accessible to anyone with a share link
* `/admin/zod-playground` + `?schema=` or `?schema_id=` supported
* Users can preview, copy JSON, or deploy

### 3. **Share & Embed Flow**

* Users generate and share links (or iframe embeds)
* Each share includes deploy, edit, export controls

## 🚀 Future Options

### ✅ Private SDK (`zod-playground-client`)

* Exposes schema utilities for trusted platforms
* Could support server-side deploys or validation

### ✅ Private CLI (`npx zod-playground`) *(not yet published)*

* Allows internal devs to generate site deploys or shortlinks from CLI

### ✅ Premium Access Tier

* Gated Slack/AI tools
* Higher deploy limits
* Schema access analytics

---

## 💬 Messaging Framework

Zod Playground is not just an editor — it’s a programmable site layer for the schema-first web.

* “Like Postman for Zod”
* “From schema to site in seconds”
* “Shareable, editable schema-driven pages”

## ✅ Next Steps

* [ ] Add open `/pitch` page
* [ ] Enable anonymous playground preview links
* [ ] Optional embed mode (`?embed=1`)
* [ ] Deploy GitHub template repo
* [ ] Secure all backend logic & audit access tokens

---

Confidential strategy document by QuickSites.ai — © 2025
