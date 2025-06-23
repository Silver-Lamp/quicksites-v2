#!/bin/bash

mkdir -p app/admin

find pages/admin -name "*.tsx" | while read oldFile; do
  relativePath="${oldFile#pages/admin/}"
  newPath="app/admin/${relativePath}"
  newPath="${newPath/index.tsx/page.tsx}"

  mkdir -p "$(dirname "$newPath")"

  # Copy and transform
  awk '
    BEGIN { inGSSP = 0 }
    /getServerSideProps/ { inGSSP = 1; print "export const runtime = '\''nodejs'\'';\n\nexport default async function Page() {"; next }
    inGSSP && /return {/ { print "\n  // Converted from getServerSideProps:"; next }
    inGSSP && /props:/ { print "  return ("; next }
    inGSSP && /\}\)/ { inGSSP = 0; print "  );\n}"; next }
    inGSSP { next }
    { print }
  ' "$oldFile" > "$newPath"

  echo "✅ Migrated & converted: $oldFile → $newPath"
done
