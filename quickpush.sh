#!/usr/bin/env bash
set -e

# === SquatBot-style Commit Prompting ===

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

# Add a label emoji based on keywords
msg_lc=$(echo "$msg" | tr '[:upper:]' '[:lower:]')
emoji="📦"
case "$msg_lc" in
  *fix*|*bug*|*patch*) emoji="🐛" ;;
  *feat*|*feature*) emoji="✨" ;;
  *chore*|*cleanup*) emoji="🧹" ;;
  *refactor*) emoji="🛠️" ;;
  *doc*|*readme*) emoji="📚" ;;
  *test*|*spec*) emoji="✅" ;;
  *style*|*format*) emoji="🎨" ;;
esac

final_msg="$emoji $msg"

# Check for --debug flag
DEBUG=false
if [[ "$1" == "--debug" ]]; then
  DEBUG=true
  echo "🔍 SquatBot Debug Mode ON"
fi

# Run typecheck before commit
npm run typecheck --no-verify

# Get latest commit SHA to track exact deployment
commit_sha=$(git rev-parse HEAD)

# Log the prompt + final message
timestamp=$(date +"%Y-%m-%d %H:%M:%S")
echo -e "[$timestamp]\nPrompt: $prompt\nCommit: $final_msg\n" >> ~/.squatbot-commits

# === Git Commit & Push ===

start_time=$(date +%s)

git add -A
git commit -m "$final_msg" --no-verify
git push -f

# === Vercel Deployment Monitoring ===

projectId=$(jq -r .projectId .vercel/project.json)

# Wait until Vercel registers a new deployment
echo "🔍 Checking for latest deployment ID..."
echo -n "🤖 Waiting for Vercel to register deployment for commit $commit_sha "
spinner="/|\\-"
max_attempts=30
attempt=0

while (( attempt < max_attempts )); do
  response=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=$projectId&meta.githubCommitSha=$commit_sha")

  $DEBUG && echo "$response" > /tmp/squatbot-debug.json

  deployment=$(echo "$response" | jq -r ".deployments[0].id")

  if [[ "$deployment" != "null" && -n "$deployment" ]]; then
    echo -e "\r✅ Found deployment ID: $deployment"
    break
  fi

  spin_char=${spinner:attempt%4:1}
  remaining=$(( (max_attempts - attempt) * 10 ))
  mins=$(( remaining / 60 ))
  secs=$(( remaining % 60 ))
  time_display=$(printf "%02d:%02d" $mins $secs)

  echo -ne "\r🤖 Waiting for deployment $spin_char ⏳ $time_display remaining"
  sleep 10
  ((attempt++))
done

if [[ "$deployment" == "null" || -z "$deployment" ]]; then
  echo -e "\n❌ Could not find a Vercel deployment for commit $commit_sha"
  $DEBUG && echo "📂 Debug JSON saved to /tmp/squatbot-debug.json"
  exit 1
fi

echo "🔄 Waiting for deployment to complete..."

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

echo ""
echo "🚀 Deployment $status: https://$url"
echo "🕒 Took $duration seconds"

# === SquatBot Deployment Quotes ===

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

speak_squatbot() {
  local quote="$1"
  if command -v say &>/dev/null; then
    say -v Fred "$quote"
  elif command -v espeak &>/dev/null; then
    espeak "$quote"
  else
    echo "🔇 No speech synthesis available."
  fi
}

log_squatbot_quote() {
  local quote="$1"
  local timestamp
  timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $quote" >> ~/.squatbot-deploys
}

if [ "$status" = "READY" ]; then
  quote=${SUCCESS_QUOTES[$RANDOM % ${#SUCCESS_QUOTES[@]}]}
else
  quote=${ERROR_QUOTES[$RANDOM % ${#ERROR_QUOTES[@]}]}
fi

echo "💬 $quote"
speak_squatbot "$quote"
log_squatbot_quote "$quote"
