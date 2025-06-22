#!/bin/bash

echo "🔄 Re-processing app/api/*/route.ts files for import fixes..."

# List of route files without .ts extension
routes=(
  "admin/delete-branding"
  "admin/delete-snapshot"
  "admin/seed-template"
  "admin/upload-template-image"
  "docs"
  "echo"
  "me"
  "verify-recaptcha"
  "weekly-digest-live"
  "send-weekly-digest"
)

for route in "${routes[@]}"; do
  file="app/api/${route}/route.ts"

  if [ ! -f "$file" ]; then
    echo "⚠️  Skipping: $file not found"
    continue
  fi

  echo "🧹 Cleaning: $file"

  sed -i '' -E '
    s/import\s+\{\s*NextApiRequest\s*,?\s*NextApiResponse\s*\}\s+from\s+.*//g;
    s/\bNextApiRequest\b/Request/g;
    s/\bNextApiResponse\b/Response/g;
    s/export\s+default\s+async\s+function\s+handler\s*\((.*)\)\s*\{/export async function POST(\1) \{/g;
    s/res\.status\([^)]+\)\.json\(([^)]+)\)/return new Response(JSON.stringify(\1), { status: 200, headers: { "Content-Type": "application\/json" } })/g;
    s/res\.json\(([^)]+)\)/return new Response(JSON.stringify(\1), { status: 200, headers: { "Content-Type": "application\/json" } })/g;
    s/res\.status\([^)]+\)\.end\((["'\''][^"'\'']*["'\''])\)/return new Response(\1)/g;
  ' "$file"
done

echo "✅ Done updating import and syntax patterns."
