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
echo -n "🤖 Waiting for Vercel to register deployment "
spinner="/|\\-"
for i in {1..20}; do
  deployment=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=$projectId" | jq -r ".deployments[0].id")

  if [[ "$deployment" != "null" && -n "$deployment" ]]; then
    echo -e "\r✅ Found deployment ID: $deployment"
    break
  fi

  spin_char=${spinner:i%4:1}
  echo -ne "\r🤖 Waiting for Vercel to register deployment $spin_char"
  sleep 0.3
done

if [[ "$deployment" == "null" || -z "$deployment" ]]; then
  echo -e "\n❌ Failed to get a valid deployment ID after multiple attempts."
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
