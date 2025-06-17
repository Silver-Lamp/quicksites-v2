#!/bin/bash

# Find all files that import from @/components/admin/ui and rewrite to @/components/ui
echo "Scanning for '@/components/admin/ui/' imports and replacing..."

grep -rl "@/components/admin/ui/" ./components ./admin ./pages ./lib ./hooks ./tests | while read file; do
  echo "Patching $file"
  sed -i '' 's|@/components/admin/ui/|@/components/ui/|g' "$file"
done

echo "✅ Rewrites complete."