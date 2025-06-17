#!/bin/bash

SRC_DIR="./components/admin/ui"
DEST_DIR="./components/ui"

if [ ! -d "$SRC_DIR" ]; then
  echo "❌ Source directory '$SRC_DIR' not found."
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "📦 Moving files from $SRC_DIR to $DEST_DIR..."

find "$SRC_DIR" -type f -name "*.tsx" -o -name "*.ts" | while read file; do
  fname=$(basename "$file")
  echo "Moving $fname"
  mv "$file" "$DEST_DIR/$fname"
done

echo "🧹 Cleaning up empty admin/ui directory..."
rmdir "$SRC_DIR" 2>/dev/null || echo "(not empty — manual check recommended)"

echo "✅ All files moved."