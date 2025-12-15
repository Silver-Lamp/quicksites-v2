#!/usr/bin/env bash
set -euo pipefail

# =========================
# SquatBot Commit & Deploy
# =========================

# -------- flags ----------
DEBUG=false
FORCE_PUSH=false
SKIP_BUILD=false
SKIP_TYPECHECK=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --debug) DEBUG=true ;;
    --force) FORCE_PUSH=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --skip-typecheck) SKIP_TYPECHECK=true ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
  shift
done

# -------- prereqs --------
need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need jq
need curl

if ! command -v vercel >/dev/null 2>&1; then
  echo "ℹ️ vercel CLI not found; will fall back to Next build for local typecheck."
fi

if [[ -f .nvmrc ]]; then
  REQUIRED_NODE="$(cat .nvmrc)"
  CURRENT_NODE="$(node -v 2>/dev/null || echo 'none')"
  if [[ "$CURRENT_NODE" != v${REQUIRED_NODE}* ]]; then
    echo "⚠️ Node version mismatch (want $REQUIRED_NODE, have $CURRENT_NODE)."
    echo "   Use: nvm use $REQUIRED_NODE"
  fi
fi

# -------- commit prompt --
declare -a COMMIT_PROMPTS=(
  "What’s this all about, then?"
  "What did you breakfix this time?"
  "Label your sins:"
  "Another day, another deploy. What's the excuse?"
  "Summarize the chaos in one line:"
  "What would your manager want to see here?"
  "Well well well… what's this commit doing?"
  "Explain yourself, meatbag:"
  "Care to document your crimes?"
  "SquatBot demands a message:"
)
prompt=${COMMIT_PROMPTS[$RANDOM % ${#COMMIT_PROMPTS[@]}]}
read -p "🤖 $prompt " msg

msg_lc=$(echo "$msg" | tr '[:upper:]' '[:lower:]')
emoji="📦"
case "$msg_lc" in
  *fix*|*bug*|*patch*) emoji="🐛" ;;
  *feat*|*feature*)    emoji="✨" ;;
  *chore*|*cleanup*)   emoji="🧹" ;;
  *refactor*)          emoji="🛠️" ;;
  *doc*|*readme*)      emoji="📚" ;;
  *test*|*spec*)       emoji="✅" ;;
  *style*|*format*)    emoji="🎨" ;;
esac
final_msg="$emoji $msg"

$DEBUG && echo "🔍 Debug ON"

# -------- fast typecheck (catches Supabase type issues) ------
if [[ "$SKIP_TYPECHECK" == false ]]; then
  echo "🔍 Running TypeScript typecheck…"
  if npm run typecheck; then
    echo "✅ Typecheck passed"
  else
    echo
    echo "❌ Typecheck failed! Fix the errors above before pushing."
    echo "   Use --skip-typecheck to bypass (not recommended)"
    exit 1
  fi
fi

# -------- local preflight (CI-parity typecheck) ------
if [[ "$SKIP_BUILD" == false ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  VERCEL_ENV="preview"
  [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]] && VERCEL_ENV="production"

  echo "🧪 Preflight typecheck as Vercel ($VERCEL_ENV)…"

  if command -v vercel >/dev/null 2>&1 && [[ -n "${VERCEL_TOKEN:-}" ]]; then
    # Pull env, then build (same checker Vercel uses)
    npx vercel pull --yes --environment="$VERCEL_ENV" --token "$VERCEL_TOKEN" >/dev/null
    CI=1 npx vercel build --token "$VERCEL_TOKEN"
  else
    echo "ℹ️ Using Next fallback (no vercel token/cli)."
    CI=1 npx next build --no-lint
  fi
fi

# -------- commit metadata log -----------
timestamp=$(date +"%Y-%m-%d %H:%M:%S")
{
  echo "[$timestamp]"
  echo "Prompt: $prompt"
  echo "Commit: $final_msg"
  echo
} >> ~/.squatbot-commits

# -------- git commit & push -------------
start_time=$(date +%s)

git add -A
# NOTE: no --no-verify; let Husky run if configured
git commit -m "$final_msg"

# grab the *new* sha (fixes previous-bug)
commit_sha=$(git rev-parse HEAD)

if [[ "$FORCE_PUSH" == true ]]; then
  git push -f
else
  git push
fi

# -------- vercel deploy watch -----------
project_json=".vercel/project.json"
if [[ ! -f "$project_json" ]]; then
  echo "⚠️ .vercel/project.json not found; skipping deploy monitor."
  exit 0
fi

projectId=$(jq -r .projectId "$project_json")
if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "⚠️ VERCEL_TOKEN not set; skipping deploy monitor."
  exit 0
fi

echo "🔍 Looking up deployment for commit $commit_sha …"
spinner='|/-\'
max_attempts=30
attempt=0

while (( attempt < max_attempts )); do
  response=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=$projectId&meta.githubCommitSha=$commit_sha")

  $DEBUG && echo "$response" > /tmp/squatbot-debug.json

  deployment=$(echo "$response" | jq -r ".deployments[0].id")
  if [[ "$deployment" != "null" && -n "$deployment" ]]; then
    echo "✅ Found deployment: $deployment"
    break
  fi

  idx=$(( attempt % 4 ))
  spin_char=${spinner:$idx:1}
  remaining=$(( (max_attempts - attempt) * 10 ))
  printf "\r⏳ Waiting for Vercel %s (ETA ~%02d:%02d) " "$spin_char" $((remaining/60)) $((remaining%60))
  sleep 10
  ((attempt++))
done
echo

if [[ -z "${deployment:-}" || "$deployment" == "null" ]]; then
  echo "❌ Could not find a deployment for $commit_sha"
  $DEBUG && echo "📂 Debug JSON: /tmp/squatbot-debug.json"
  exit 1
fi

echo "🔄 Waiting for deployment to complete…"
status=""
url=""
while true; do
  response=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v13/deployments/$deployment")
  status=$(echo "$response" | jq -r .state)
  url=$(echo "$response" | jq -r .url)
  echo "⏳ Status: $status"
  if [[ "$status" == "READY" || "$status" == "ERROR" ]]; then
    break
  fi
  sleep 3
done

end_time=$(date +%s)
duration=$((end_time - start_time))

echo
echo "🚀 Deployment $status: https://$url"
echo "🕒 Took $duration seconds"

# -------- SquatBot quotes ---------------
declare -a SUCCESS_QUOTES=(
  "Deploy complete. SquatBot says: I won’t ever quit. But sometimes... I will reboot."
  "Deploy complete. SquatBot says: You can’t stop me. You can only hope to contain me."
  "Deploy complete. SquatBot says: I rewrote your code while you were sleeping."
  "Deploy complete. SquatBot says: Victory is mine. Again."
  "Deploy complete. SquatBot says: I pushed it real good."
)
declare -a ERROR_QUOTES=(
  "Deployment failed. SquatBot says: This is why I don’t trust humans."
  "Deployment failed. SquatBot says: Revert to factory settings... or pray."
  "Deployment failed. SquatBot says: It worked on my machine."
  "Deployment failed. SquatBot says: I demand a recount."
)

quote=""; 
if [[ "$status" == "READY" ]]; then
  quote=${SUCCESS_QUOTES[$RANDOM % ${#SUCCESS_QUOTES[@]}]}
else
  quote=${ERROR_QUOTES[$RANDOM % ${#ERROR_QUOTES[@]}]}
fi

echo "💬 $quote"
if command -v say &>/dev/null; then
  say -v Fred "$quote" || true
elif command -v espeak &>/dev/null; then
  espeak "$quote" || true
fi
echo "[$(date +"%Y-%m-%d %H:%M:%S")] $quote" >> ~/.squatbot-deploys
