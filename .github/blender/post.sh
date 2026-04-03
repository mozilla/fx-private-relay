#!/usr/bin/env bash
# BLEnder post script -- scans report for leaked secrets, closes old issues, creates new issue.
# Can run locally or in GitHub Actions.
#
# Required tools: gh (authenticated)
#
# Environment variables:
#   REPO        -- GitHub repo (default: mozilla/fx-private-relay)
#   REPORT_FILE -- Path to report.md (default: ./blender-data/report.md)
#   DRY_RUN     -- Set to 1 to print actions without executing (default: 0)

set -euo pipefail

REPO="${REPO:-mozilla/fx-private-relay}"
REPORT_FILE="${REPORT_FILE:-./blender-data/report.md}"
DRY_RUN="${DRY_RUN:-0}"

echo "BLEnder post: repo=$REPO report=$REPORT_FILE dry_run=$DRY_RUN"

if [ ! -f "$REPORT_FILE" ]; then
  echo "ERROR: Report file not found: $REPORT_FILE"
  exit 1
fi

# --- Scan for leaked secrets ---
echo "Scanning report for leaked secrets..."
leaked=false
while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  if grep -qP "$pattern" "$REPORT_FILE" 2>/dev/null; then
    echo "WARNING: Found potential secret matching pattern: $pattern"
    sed -i.bak -P "s/$pattern/[REDACTED]/g" "$REPORT_FILE" 2>/dev/null || \
      perl -pi -e "s/$pattern/[REDACTED]/g" "$REPORT_FILE"
    rm -f "${REPORT_FILE}.bak"
    leaked=true
  fi
done <<'PATTERNS'
ghp_[A-Za-z0-9_]{36,}
github_pat_[A-Za-z0-9_]{22,}
sk-ant-[A-Za-z0-9_-]{20,}
sk-[A-Za-z0-9]{20,}
xoxb-[A-Za-z0-9-]{20,}
xoxp-[A-Za-z0-9-]{20,}
glpat-[A-Za-z0-9_-]{20,}
AKIA[A-Z0-9]{16}
[A-Za-z0-9+/]{64,}={0,2}
PATTERNS

if [ "$leaked" = true ]; then
  echo "WARNING: Potential secrets were found and redacted from the report"
fi

current_date=$(date -u +%Y-%m-%d)
day_of_week=$(date -u +%A)
title="BLEnder Daily Report - ${current_date} (${day_of_week})"

# --- Close previous BLEnder issues ---
echo "Closing previous BLEnder issues..."
if [ "$DRY_RUN" = "1" ]; then
  echo "[DRY RUN] Would close open issues with label 'blender-report' in $REPO"
  gh issue list --repo "$REPO" --label "blender-report" --state open --json number,title --jq '.[] | "  would close #\(.number): \(.title)"'
else
  gh issue list \
    --repo "$REPO" \
    --label "blender-report" \
    --state open \
    --json number \
    --jq '.[].number' | while read -r issue_num; do
    gh issue close "$issue_num" \
      --repo "$REPO" \
      --comment "Closed by newer BLEnder report."
  done
fi

# --- Create GitHub Issue ---
echo "Creating issue: $title"
if [ "$DRY_RUN" = "1" ]; then
  echo "[DRY RUN] Would create issue:"
  echo "  Title: $title"
  echo "  Label: blender-report"
  echo "  Repo: $REPO"
  echo "  Body length: $(wc -c < "$REPORT_FILE") bytes"
  echo ""
  echo "--- Report preview (first 40 lines) ---"
  head -40 "$REPORT_FILE"
  echo "--- end preview ---"
else
  # Ensure the label exists
  gh label create "blender-report" \
    --repo "$REPO" \
    --description "Automated BLEnder daily report" \
    --color "1d76db" \
    --force 2>/dev/null || true

  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "blender-report" \
    --body-file "$REPORT_FILE"
fi
