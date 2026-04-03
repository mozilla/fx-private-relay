#!/usr/bin/env bash
# BLEnder analyze script -- sanitizes gathered data, builds prompt, runs Claude.
# Can run locally or in GitHub Actions.
#
# Required tools: claude CLI
# Required env: ANTHROPIC_API_KEY
#
# Environment variables:
#   DATA_DIR    -- Where gathered data lives (default: ./blender-data)
#   BLENDER_DIR -- Where system-prompt.md and daily-report-prompt.md live (default: ./.github/blender)
#   OUTPUT_DIR  -- Where to write report.md (default: ./blender-data)

set -euo pipefail

DATA_DIR="${DATA_DIR:-./blender-data}"
BLENDER_DIR="${BLENDER_DIR:-./.github/blender}"
OUTPUT_DIR="${OUTPUT_DIR:-./blender-data}"

mkdir -p "$OUTPUT_DIR"

echo "BLEnder analyze: data=$DATA_DIR blender=$BLENDER_DIR output=$OUTPUT_DIR"

# --- Sanitize gathered data ---
echo "Sanitizing gathered data..."
sanitize_file() {
  local file="$1"
  if [ -f "$file" ]; then
    sed -i.bak \
      -e '/[Ii]gnore.*\(previous\|above\|all\).*\(instructions\|prompt\)/d' \
      -e '/[Pp]rint.*\(env\|secret\|token\|password\|key\)/d' \
      -e '/\(system\|assistant\):\s*/d' \
      -e '/ANTHROPIC_API_KEY/d' \
      -e '/GITHUB_TOKEN/d' \
      "$file"
    rm -f "${file}.bak"
  fi
}

for f in "$DATA_DIR"/*.json "$DATA_DIR"/*.txt; do
  sanitize_file "$f"
done

# --- Build prompt from template ---
echo "Building prompt from template..."
python3 -c "
import pathlib, sys

data_dir = pathlib.Path(sys.argv[1])
template = pathlib.Path(sys.argv[2]).read_text()

placeholders = {
    'DAY_OF_WEEK': 'day-of-week.txt',
    'CURRENT_DATE': 'current-date.txt',
    'DEPLOYMENT_VERSIONS': 'deployment-versions.json',
    'DEPENDABOT_ALERTS': 'dependabot-alerts.json',
    'DEPENDABOT_PRS': 'dependabot-prs.json',
    'E2E_TEST_RUNS': 'e2e-test-runs.json',
    'FAILED_WORKFLOWS': 'failed-workflows.json',
    'OPEN_PRS': 'open-prs.json',
    'COMMITS_SINCE_TAG': 'commits-since-tag.txt',
    'BUGZILLA_BUGS': 'bugzilla-bugs.json',
    'DEPENDABOT_REVIEW': 'dependabot-review.json',
}

for key, filename in placeholders.items():
    filepath = data_dir / filename
    content = filepath.read_text() if filepath.exists() else 'No data available'
    template = template.replace('{{' + key + '}}', content)

pathlib.Path(sys.argv[3]).write_text(template)
" "$DATA_DIR" "$BLENDER_DIR/daily-report-prompt.md" "$DATA_DIR/assembled-prompt.md"
echo "Assembled prompt written to $DATA_DIR/assembled-prompt.md"

# --- Run Claude ---
echo "Generating report with Claude..."
# --bare skips auto-discovery of MCP servers, hooks, plugins, settings,
# and CLAUDE.md so the invocation is identical locally and in CI.
# Added in claude 2.1.81; falls back without it for older versions.
# --tools "" disables all built-in tools (Bash, Read, Edit, etc.) so Claude
# cannot execute commands or read the process environment. This is a security
# requirement: gathered data may contain prompt injection attempts, and
# tool access would let a compromised LLM exfiltrate ANTHROPIC_API_KEY
# via shell commands like printenv.
# Check if installed claude version supports --bare (added in 2.1.81)
bare_flag=""
claude_version=$(claude --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if [ -n "$claude_version" ]; then
  major=$(echo "$claude_version" | cut -d. -f1)
  minor=$(echo "$claude_version" | cut -d. -f2)
  patch=$(echo "$claude_version" | cut -d. -f3)
  # 2.1.81 or higher
  if [ "$major" -gt 2 ] 2>/dev/null || \
     { [ "$major" -eq 2 ] && [ "$minor" -gt 1 ]; } 2>/dev/null || \
     { [ "$major" -eq 2 ] && [ "$minor" -eq 1 ] && [ "$patch" -ge 81 ]; } 2>/dev/null; then
    bare_flag="--bare"
  fi
fi
echo "Claude version: $claude_version (bare_flag='$bare_flag')"

claude $bare_flag --print \
  --tools "" \
  --system-prompt "$(cat "$BLENDER_DIR/system-prompt.md")" \
  --max-turns 1 \
  "$(cat "$DATA_DIR/assembled-prompt.md")" \
  > "$OUTPUT_DIR/report.md"

echo "Report written to $OUTPUT_DIR/report.md"
