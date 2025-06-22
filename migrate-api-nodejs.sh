#!/bin/bash

echo "🔧 Rewriting API response patterns in app/api..."

grep -rl "res\." app/api | while read file; do
  echo "🛠️ Updating $file"

  # Remove `res` type imports
  sed -i '' -e '/NextApiResponse/d' "$file"

  # Rewrite response patterns
  sed -i '' \
    -e 's/res\.status(\([0-9]\+\))\.json(\(.*\))/return Response.json(\2, { status: \1 })/' \
    -e 's/res\.status(\([0-9]\+\))\.send(\(.*\))/return new Response(\2, { status: \1 })/' \
    -e 's/res\.send(\(.*\))/return new Response(\1)/' \
    "$file"
done

echo "✅ Done rewriting API responses."
