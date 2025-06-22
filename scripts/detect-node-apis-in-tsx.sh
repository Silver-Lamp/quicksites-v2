#!/bin/bash

echo "🔍 Scanning for Node.js-only modules used in TSX files..."

for module in fs path child_process os net dns; do
  matches=$(grep -r --include="*.tsx" "from ['\"]$module['\"]" .)

  if [ -n "$matches" ]; then
    echo "⚠️  Found '$module' used in the following .tsx files:"
    echo "$matches"
    echo ""
  fi
done

echo "✅ Scan complete. These modules should be moved to /scripts, API routes, or 'use server' files only."
