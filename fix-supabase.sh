# Step 1: Replace env var name if used directly
rg --files-with-matches "process\.env\.SUPABASE_URL" | while read file; do
  sed -i '' 's|process\.env\.SUPABASE_URL|process.env.NEXT_PUBLIC_SUPABASE_URL|g' "$file"
done

# Step 2: Detect & replace createClient() with serviceClient
rg --files-with-matches "createClient\(.*SUPABASE_SERVICE_ROLE_KEY" ./app/api | while read file; do
  # Remove the createClient line
  sed -i '' '/createClient.*SUPABASE_SERVICE_ROLE_KEY/d' "$file"

  # Add the import if it doesn't exist
  grep -q "serviceClient" "$file" || \
    sed -i '' '1s|^|import { serviceClient as supabase } from "@/lib/supabase/service";\n|' "$file"
done

# Step 3: Remove unsafe usage of NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
rg --files-with-matches "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" | while read file; do
  sed -i '' 's|process\.env\.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY|process.env.SUPABASE_SERVICE_ROLE_KEY|g' "$file"
done
