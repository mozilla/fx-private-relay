#!/usr/bin/env bash
# BLEnder fix-dependabot: diagnose and fix CI failures on Dependabot PRs.
#
# Environment variables:
#   PR_NUMBER          -- PR number to fix (required)
#   REPO               -- GitHub repo, e.g. mozilla/fx-private-relay (required)
#   ANTHROPIC_API_KEY  -- Anthropic API key (required)
#   DRY_RUN            -- Set to "true" to skip push (default: true)
#   GH_TOKEN           -- GitHub token for API calls (optional, uses gh auth)
#   BLENDER_DIR        -- Path to blender directory (default: .github/blender)

set -euo pipefail

BLENDER_DIR="${BLENDER_DIR:-.github/blender}"
DRY_RUN="${DRY_RUN:-true}"
PROMPT_TEMPLATE="$BLENDER_DIR/fix-dependabot-prompt.md"

if [ -z "${PR_NUMBER:-}" ] || [ -z "${REPO:-}" ]; then
  echo "Error: PR_NUMBER and REPO are required."
  exit 1
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Error: ANTHROPIC_API_KEY is required."
  exit 1
fi

echo "BLEnder fix-dependabot: PR #${PR_NUMBER} repo=${REPO} dry_run=${DRY_RUN}"

# --- Fetch PR metadata ---
echo "Fetching PR metadata..."
pr_json=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}")
pr_title=$(echo "$pr_json" | jq -r '.title')
pr_branch=$(echo "$pr_json" | jq -r '.head.ref')
pr_sha=$(echo "$pr_json" | jq -r '.head.sha')

echo "  Title: ${pr_title}"
echo "  Branch: ${pr_branch}"
echo "  SHA: ${pr_sha}"

# --- Fetch failing checks ---
echo "Fetching check runs..."
checks_json=$(gh api "repos/${REPO}/commits/${pr_sha}/check-runs" --paginate)
failing_checks=$(echo "$checks_json" | jq -r '.check_runs[] | select(.conclusion == "failure") | .name')

if [ -z "$failing_checks" ]; then
  echo "No failing checks found. Nothing to fix."
  exit 0
fi

echo "Failing checks:"
echo "$failing_checks" | while read -r check; do
  echo "  - ${check}"
done

# --- Fetch CI logs for failing checks ---
echo "Fetching CI logs for failing checks..."
ci_logs=""

while IFS= read -r check_name; do
  [ -z "$check_name" ] && continue
  echo "  Fetching logs for: ${check_name}"

  # Get the check run ID and details URL
  check_run=$(echo "$checks_json" | jq -r --arg name "$check_name" \
    '.check_runs[] | select(.name == $name and .conclusion == "failure") | {id, details_url, html_url}' | head -1)
  check_id=$(echo "$check_run" | jq -r '.id')

  # Try GitHub Actions log annotation (works for GHA checks)
  annotations=""
  if [ -n "$check_id" ] && [ "$check_id" != "null" ]; then
    annotations=$(gh api "repos/${REPO}/check-runs/${check_id}/annotations" 2>/dev/null \
      | jq -r '.[] | "  \(.path):\(.start_line): \(.annotation_level): \(.message)"' 2>/dev/null || true)
  fi

  ci_logs="${ci_logs}

### Check: ${check_name}
"
  if [ -n "$annotations" ]; then
    ci_logs="${ci_logs}Annotations:
${annotations}
"
  else
    ci_logs="${ci_logs}(No log annotations available. Run the check locally to see errors.)
"
  fi
done <<< "$failing_checks"

# --- Build the prompt ---
echo "Building prompt..."
prompt=$(cat "$PROMPT_TEMPLATE")
prompt="${prompt/\{\{PR_TITLE\}\}/$pr_title}"
prompt="${prompt/\{\{FAILING_CHECKS\}\}/$failing_checks}"
prompt="${prompt/\{\{CI_LOGS\}\}/$ci_logs}"

# --- Run Claude ---
echo "Running Claude Code to diagnose and fix..."
claude_output=$(echo "$prompt" | claude \
  --print \
  --max-turns 5 \
  --allowedTools "Read,Edit,Bash" \
  --systemPrompt "You are BLEnder, a CI-fixing agent for Firefox Relay. Fix the CI failure described in the prompt. Be minimal and precise." \
  2>&1) || true

echo ""
echo "=== Claude output ==="
echo "$claude_output"
echo "=== End Claude output ==="

# --- Check for changes ---
if git diff --quiet && git diff --cached --quiet; then
  echo ""
  echo "No file changes produced. Claude could not fix this automatically."
  exit 0
fi

echo ""
echo "=== Changes produced ==="
git diff --stat
echo ""

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY_RUN=true -- not committing or pushing."
  echo "Review changes with: git diff"
  exit 0
fi

# --- Commit and push ---
echo "Committing and pushing fix..."
git config user.email "<>"
git config user.name "BLEnder"
git add -A
git commit -m "fix: auto-fix CI failure from dependency update

BLEnder auto-fix for PR #${PR_NUMBER}
Failing checks: $(echo "$failing_checks" | tr '\n' ', ')"
git push

echo "Fix pushed to branch ${pr_branch}."
