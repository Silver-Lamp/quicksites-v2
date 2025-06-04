# Query Param Schema Use Cases

This document outlines the extended use cases for the `queryParamSchemas` system and `/param-lab` interface, especially as they relate to LogLens, telemetry, analytics, and public tools.

---

## 🔍 Log-Driven Use Cases

### 1. Schema-Based Log Enrichment
- Decode raw log entries (e.g. `filters=%5B%7B...%7D%5D`)
- Validate against `zod` schemas
- Enrich logs with decoded + validated state

**Example:**
```log
filters=invalid (expected type=array of {type: string})
```

---

### 2. Live Query Inspection via LogLens
- Stream incoming query params from frontend/backend
- Validate against registered schemas
- Visualize mismatch vs expected
- View decoded/parsed result for observability

---

### 3. Session Replay + Debugging
- Save or log full URLs for recreation
- Load into `/param-lab` or in-app tools
- Restore stateful dashboards, search configs, etc.

---

## 🛡️ Security & Guardrails

### 4. Safe Public Link Validation
- Prevent malformed/malicious inputs
- Validate shared or embedded query strings
- Auto-redirect invalid URLs with safe fallbacks

---

### 5. API Contract Testing
- Validate frontend query usage against registered schemas
- Generate links for dev/QA handoff
- Compare param schemas with API-level OpenAPI schemas

---

## 🧠 AI/Prompt + Context Use Cases

### 6. Typed AI Prompt State
- Store structured agent prompts in `?prompt={...}`
- Decode, validate, and restore into prompt builders
- LogLens can introspect and replay reasoning state

---

## 🌍 Community Use / Outreach

### 7. Public Param Lab Playground
- `/param-lab` allows schema editing + sharing
- Copy links with safe embedded config
- Build community trust around open schemas

---

## ✅ Implementation Touchpoints

| Area | Integration |
|------|-------------|
| CLI | `scripts/query-inspector.ts` |
| Docs | `generate-query-docs.ts` |
| Admin UI | `/admin/query-docs.tsx` |
| Logs | Supabase `param_lab_events` |
| Links | `useSafeQueryParam()` + `queryParamSchemas` |

---

## 🧭 Next Ideas

- 🌱 Live prompt previews in ParamLab
- 🎯 Embed-ready share UI
- 🔍 AI validation: "Why is this query invalid?"
- 🧪 Snapshot URL test runner