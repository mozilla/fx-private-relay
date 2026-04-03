#!/usr/bin/env bash
# BLEnder gather script -- collects data from GitHub, Bugzilla, and deployment endpoints.
# Can run locally or in GitHub Actions.
#
# Required tools: gh (authenticated), curl, jq, git
#
# Environment variables:
#   REPO       -- GitHub repo (default: mozilla/fx-private-relay)
#   REPO_DIR   -- Path to git checkout for commits-since-tag (default: .)
#   OUTPUT_DIR -- Where to write data files (default: ./blender-data)

set -euo pipefail

REPO="${REPO:-mozilla/fx-private-relay}"
REPO_DIR="${REPO_DIR:-.}"
OUTPUT_DIR="${OUTPUT_DIR:-./blender-data}"

mkdir -p "$OUTPUT_DIR"

echo "BLEnder gather: repo=$REPO repo_dir=$REPO_DIR output=$OUTPUT_DIR"

# --- Date context ---
date -u +%Y-%m-%d > "$OUTPUT_DIR/current-date.txt"
date -u +%A > "$OUTPUT_DIR/day-of-week.txt"
echo "Date: $(cat "$OUTPUT_DIR/current-date.txt") ($(cat "$OUTPUT_DIR/day-of-week.txt"))"

# --- Deployment versions ---
echo "Fetching deployment versions..."
get_version() {
  local url="$1"
  local env_name="$2"
  response=$(curl -sf --max-time 10 "$url" 2>/dev/null) || response='{"error": "unreachable"}'
  echo "$response" | jq -c --arg env "$env_name" '{env: $env} + .'
}

{
  echo "["
  get_version "https://relay.firefox.com/__version__" "prod"
  echo ","
  get_version "https://relay.allizom.org/__version__" "stage"
  echo ","
  get_version "https://relay-dev.allizom.org/__version__" "dev"
  echo "]"
} > "$OUTPUT_DIR/deployment-versions.json"

# --- Dependabot security alerts ---
echo "Fetching Dependabot security alerts..."
gh api \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/dependabot/alerts?state=open&per_page=100" \
  --jq '[.[] | {
    number: .number,
    severity: .security_advisory.severity,
    package: .dependency.package.name,
    ecosystem: .dependency.package.ecosystem,
    summary: .security_advisory.summary,
    created_at: .created_at
  }]' > "$OUTPUT_DIR/dependabot-alerts.json" 2>/dev/null || echo "[]" > "$OUTPUT_DIR/dependabot-alerts.json"

# --- Dependabot PRs ---
echo "Fetching Dependabot PRs..."
gh pr list \
  --repo "$REPO" \
  --author "app/dependabot" \
  --state open \
  --json number,title,createdAt,labels,statusCheckRollup,url \
  --jq '[.[] | {
    number: .number,
    title: .title,
    created_at: .createdAt,
    url: .url,
    ci_status: (
      if (.statusCheckRollup | length) == 0 then "pending"
      elif (.statusCheckRollup | all(.conclusion == "SUCCESS")) then "passing"
      elif (.statusCheckRollup | any(.conclusion == "FAILURE")) then "failing"
      else "in_progress"
      end
    ),
    age_days: (
      ((now - (.createdAt | fromdateiso8601)) / 86400) | floor
    )
  }]' > "$OUTPUT_DIR/dependabot-prs.json"

# --- Dependabot review (classification + cooldown) ---
BLENDER_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$BLENDER_DIR/dependabot-review.sh" ]; then
  echo "Running Dependabot review..."
  DATA_DIR="$OUTPUT_DIR" BLENDER_DIR="$BLENDER_DIR" \
    "$BLENDER_DIR/dependabot-review.sh"
fi

# --- E2E test runs ---
echo "Fetching E2E test runs..."
gh api \
  "/repos/${REPO}/actions/workflows/playwright.yml/runs?per_page=5&status=completed" \
  --jq '{runs: [.workflow_runs[] | {
    id: .id,
    conclusion: .conclusion,
    created_at: .created_at,
    head_branch: .head_branch,
    event: .event,
    url: .html_url
  }]}' > "$OUTPUT_DIR/e2e-test-runs.json"

# --- Failed workflows (last 24h) ---
echo "Fetching failed workflows..."
# macOS date vs GNU date
since=$(date -u -d "24 hours ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)
gh api \
  "/repos/${REPO}/actions/runs?status=failure&created=%3E${since}&per_page=20" \
  --jq '{failed_runs: [.workflow_runs[] | {
    id: .id,
    name: .name,
    conclusion: .conclusion,
    created_at: .created_at,
    head_branch: .head_branch,
    url: .html_url
  }]}' > "$OUTPUT_DIR/failed-workflows.json"

# --- Open PRs needing review ---
echo "Fetching open PRs..."
gh pr list \
  --repo "$REPO" \
  --state open \
  --json number,title,author,createdAt,reviewDecision,labels,url,isDraft \
  --jq '[.[] | select(.author.login != "dependabot[bot]" and .author.login != "app/dependabot" and .isDraft == false) | {
    number: .number,
    title: .title,
    author: .author.login,
    created_at: .createdAt,
    review_status: (.reviewDecision // "REVIEW_REQUIRED"),
    url: .url,
    age_days: (
      ((now - (.createdAt | fromdateiso8601)) / 86400) | floor
    )
  }]' > "$OUTPUT_DIR/open-prs.json"

# --- Commits since last tag ---
echo "Fetching commits since last tag..."
pushd "$REPO_DIR" > /dev/null
latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$latest_tag" ]; then
  {
    echo "Latest tag: $latest_tag"
    echo "---"
    git log "${latest_tag}..HEAD" --oneline --no-merges
  } > "$OUTPUT_DIR/commits-since-tag.txt"
else
  echo "No tags found" > "$OUTPUT_DIR/commits-since-tag.txt"
fi
popd > /dev/null

# --- Bugzilla bugs ---
echo "Fetching Bugzilla bugs..."
passmgr_url="https://bugzilla.mozilla.org/rest/bug?product=Toolkit&component=Password%20Manager&short_desc=relay&short_desc_type=allwordssubstr&chfieldfrom=-7d&chfield=%5BBug%20creation%5D&include_fields=id,summary,status,resolution,creation_time,assigned_to,priority,severity"
passmgr_bugs=$(curl -sf --max-time 15 "$passmgr_url" 2>/dev/null) || passmgr_bugs='{"bugs":[]}'

relay_url="https://bugzilla.mozilla.org/rest/bug?product=Mozilla%20Relay&chfieldfrom=-7d&chfield=%5BBug%20creation%5D&include_fields=id,summary,status,resolution,creation_time,assigned_to,priority,severity"
relay_bugs=$(curl -sf --max-time 15 "$relay_url" 2>/dev/null) || relay_bugs='{"bugs":[]}'

jq -n \
  --argjson passmgr "$passmgr_bugs" \
  --argjson relay "$relay_bugs" \
  '{
    password_manager_relay_bugs: $passmgr.bugs,
    relay_component_bugs: $relay.bugs
  }' > "$OUTPUT_DIR/bugzilla-bugs.json"

echo "Gather complete. Files written to $OUTPUT_DIR:"
ls -la "$OUTPUT_DIR"
