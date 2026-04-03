#!/usr/bin/env bash
# BLEnder Dependabot review script -- classifies open Dependabot PRs.
# Reads dependabot-prs.json, checks cooldown via registry APIs, writes dependabot-review.json.
#
# Required tools: jq, curl, npm (for npm registry lookups)
#
# Environment variables:
#   DATA_DIR            -- Where dependabot-prs.json lives (default: ./blender-data)
#   BLENDER_DIR         -- Where safe-dependencies.txt lives (default: ./.github/blender)
#   COOLDOWN_DAYS       -- Days since publish before auto-merge (default: 8)
#   MAJOR_COOLDOWN_DAYS -- Cooldown for major bumps (default: 14)
#   SKIP_COOLDOWN_CHECK -- Set to 1 to skip registry API calls and use cached data

set -euo pipefail

DATA_DIR="${DATA_DIR:-./blender-data}"
BLENDER_DIR="${BLENDER_DIR:-./.github/blender}"
COOLDOWN_DAYS="${COOLDOWN_DAYS:-8}"
MAJOR_COOLDOWN_DAYS="${MAJOR_COOLDOWN_DAYS:-14}"
SKIP_COOLDOWN_CHECK="${SKIP_COOLDOWN_CHECK:-0}"

SAFE_LIST="$BLENDER_DIR/safe-dependencies.txt"
PRS_FILE="$DATA_DIR/dependabot-prs.json"
OUTPUT_FILE="$DATA_DIR/dependabot-review.json"
COOLDOWN_CACHE="$DATA_DIR/cooldown-cache.json"

echo "BLEnder dependabot-review: data=$DATA_DIR cooldown=${COOLDOWN_DAYS}d major_cooldown=${MAJOR_COOLDOWN_DAYS}d"

if [ ! -f "$PRS_FILE" ]; then
  echo "No dependabot-prs.json found. Skipping review."
  echo "[]" > "$OUTPUT_FILE"
  exit 0
fi

pr_count=$(jq 'length' "$PRS_FILE")
if [ "$pr_count" -eq 0 ]; then
  echo "No open Dependabot PRs. Skipping review."
  echo "[]" > "$OUTPUT_FILE"
  exit 0
fi

echo "Reviewing $pr_count Dependabot PRs..."

# --- Load safe list patterns ---
load_safe_patterns() {
  local patterns=()
  if [ -f "$SAFE_LIST" ]; then
    while IFS= read -r line; do
      line="${line%%#*}"          # strip comments
      line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
      line="${line%"${line##*[![:space:]]}"}"  # trim trailing whitespace
      [ -z "$line" ] && continue
      patterns+=("$line")
    done < "$SAFE_LIST"
  fi
  printf '%s\n' "${patterns[@]}"
}

SAFE_PATTERNS=$(load_safe_patterns)

# --- Check if a package matches the safe list ---
matches_safe_list() {
  local pkg="$1"
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # Convert glob pattern to regex: * becomes .*
    local regex="^${pattern//\*/.*}$"
    if echo "$pkg" | grep -qE "$regex"; then
      return 0
    fi
  done <<< "$SAFE_PATTERNS"
  return 1
}

# --- Parse package name, ecosystem, and version bump from PR title ---
parse_pr_title() {
  local title="$1"
  local pkg=""
  local from_ver=""
  local to_ver=""
  local ecosystem=""

  # Pattern: "Bump <pkg> from <ver> to <ver>"
  if echo "$title" | grep -qiE 'bump .+ from .+ to '; then
    pkg=$(echo "$title" | sed -E 's/[Bb]ump ([^ ]+) from .*/\1/')
    from_ver=$(echo "$title" | sed -E 's/.*from ([^ ]+) to .*/\1/')
    to_ver=$(echo "$title" | sed -E 's/.*to ([^ ]+).*/\1/')
  fi

  # Detect ecosystem from title or package name
  if echo "$title" | grep -qiE '/requirements|/pip|\.txt'; then
    ecosystem="pip"
  elif echo "$title" | grep -qiE '/npm|/yarn|package\.json'; then
    ecosystem="npm"
  elif echo "$title" | grep -qiE '/github-actions|actions/'; then
    ecosystem="github-actions"
  elif echo "$pkg" | grep -qE '^@'; then
    ecosystem="npm"
  else
    # Guess from package name conventions
    if echo "$pkg" | grep -qE '^(django|boto|mypy|pytest|coverage|responses|model-bakery|ruff|black|types-)'; then
      ecosystem="pip"
    else
      ecosystem="npm"
    fi
  fi

  echo "$pkg|$from_ver|$to_ver|$ecosystem"
}

# --- Detect major version bump ---
is_major_bump() {
  local from_ver="$1"
  local to_ver="$2"

  # Strip leading v
  from_ver="${from_ver#v}"
  to_ver="${to_ver#v}"

  local from_major="${from_ver%%.*}"
  local to_major="${to_ver%%.*}"

  if [ -n "$from_major" ] && [ -n "$to_major" ] && [ "$from_major" != "$to_major" ]; then
    return 0
  fi
  return 1
}

# --- Check publish date from registry ---
get_publish_date() {
  local pkg="$1"
  local version="$2"
  local ecosystem="$3"
  local publish_date=""

  if [ "$SKIP_COOLDOWN_CHECK" = "1" ]; then
    # Try cache
    if [ -f "$COOLDOWN_CACHE" ]; then
      publish_date=$(jq -r --arg k "${pkg}@${version}" '.[$k] // empty' "$COOLDOWN_CACHE" 2>/dev/null || true)
    fi
    if [ -n "$publish_date" ]; then
      echo "$publish_date"
      return
    fi
    echo ""
    return
  fi

  case "$ecosystem" in
    npm)
      # npm view returns time object with version keys
      publish_date=$(npm view "${pkg}@${version}" time --json 2>/dev/null \
        | jq -r --arg v "$version" '.[$v] // empty' 2>/dev/null || true)
      ;;
    pip)
      publish_date=$(curl -sf --max-time 10 "https://pypi.org/pypi/${pkg}/${version}/json" 2>/dev/null \
        | jq -r '.urls[0].upload_time_iso_8601 // empty' 2>/dev/null || true)
      ;;
    github-actions)
      # Skip cooldown for GitHub Actions
      publish_date=""
      ;;
  esac

  # Cache the result
  if [ -n "$publish_date" ]; then
    if [ -f "$COOLDOWN_CACHE" ]; then
      local tmp
      tmp=$(mktemp)
      jq --arg k "${pkg}@${version}" --arg v "$publish_date" '. + {($k): $v}' "$COOLDOWN_CACHE" > "$tmp"
      mv "$tmp" "$COOLDOWN_CACHE"
    else
      jq -n --arg k "${pkg}@${version}" --arg v "$publish_date" '{($k): $v}' > "$COOLDOWN_CACHE"
    fi
  fi

  echo "$publish_date"
}

# --- Calculate days since a date ---
days_since() {
  local date_str="$1"
  [ -z "$date_str" ] && echo "" && return

  local now_epoch
  now_epoch=$(date +%s)

  local then_epoch
  # Try GNU date first, fall back to macOS date
  then_epoch=$(date -d "$date_str" +%s 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%S" "${date_str%%.*}" +%s 2>/dev/null || echo "")

  if [ -z "$then_epoch" ]; then
    echo ""
    return
  fi

  echo $(( (now_epoch - then_epoch) / 86400 ))
}

# --- Main: process each PR ---
results="[]"

for i in $(seq 0 $((pr_count - 1))); do
  pr=$(jq ".[$i]" "$PRS_FILE")
  title=$(echo "$pr" | jq -r '.title')
  ci_status=$(echo "$pr" | jq -r '.ci_status')
  pr_number=$(echo "$pr" | jq -r '.number')
  pr_url=$(echo "$pr" | jq -r '.url')

  echo "  PR #${pr_number}: ${title}"

  # Parse the PR title
  parsed=$(parse_pr_title "$title")
  pkg=$(echo "$parsed" | cut -d'|' -f1)
  from_ver=$(echo "$parsed" | cut -d'|' -f2)
  to_ver=$(echo "$parsed" | cut -d'|' -f3)
  ecosystem=$(echo "$parsed" | cut -d'|' -f4)

  # Determine classification
  classification="RECOMMEND"
  decision="comment"
  reason=""
  cooldown_status="unknown"
  publish_date=""
  days_since_publish=""
  is_safe=false
  is_major=false

  # Check safe list
  if matches_safe_list "$pkg"; then
    is_safe=true
  fi

  # Check major bump
  if [ -n "$from_ver" ] && [ -n "$to_ver" ] && is_major_bump "$from_ver" "$to_ver"; then
    is_major=true
  fi

  # Check CI status first -- failing CI always means MANUAL
  if [ "$ci_status" = "failing" ]; then
    classification="MANUAL"
    decision="skip"
    reason="failing CI"
    cooldown_status="not_checked"
  elif [ "$is_major" = true ]; then
    classification="MANUAL"
    decision="skip"
    reason="major version bump"
    cooldown_status="not_checked"
  else
    # Check cooldown
    if [ -n "$pkg" ] && [ -n "$to_ver" ]; then
      publish_date=$(get_publish_date "$pkg" "$to_ver" "$ecosystem")
      if [ -n "$publish_date" ]; then
        days_since_publish=$(days_since "$publish_date")
        if [ -n "$days_since_publish" ]; then
          if [ "$days_since_publish" -ge "$COOLDOWN_DAYS" ]; then
            cooldown_status="met"
          else
            cooldown_status="pending"
          fi
        fi
      elif [ "$ecosystem" = "github-actions" ]; then
        # GitHub Actions don't have a registry; skip cooldown
        cooldown_status="not_applicable"
      else
        cooldown_status="unknown"
      fi
    fi

    # Classify
    if [ "$is_safe" = true ] && [ "$ci_status" = "passing" ] && [ "$cooldown_status" = "met" ]; then
      classification="SAFE"
      decision="approve_and_merge"
      reason="safe-listed, CI passing, cooldown met (${days_since_publish}d)"
    elif [ "$is_safe" = true ] && [ "$ci_status" = "passing" ] && [ "$cooldown_status" = "not_applicable" ]; then
      classification="SAFE"
      decision="approve_and_merge"
      reason="safe-listed, CI passing"
    elif [ "$is_safe" = true ] && [ "$ci_status" = "passing" ] && [ "$cooldown_status" = "pending" ]; then
      classification="COOLDOWN_PENDING"
      decision="wait"
      remaining=$((COOLDOWN_DAYS - days_since_publish))
      reason="safe-listed, CI passing, cooldown pending (${days_since_publish}d/${COOLDOWN_DAYS}d, ${remaining}d remaining)"
    elif [ "$is_safe" = true ] && [ "$ci_status" = "passing" ]; then
      # Cooldown unknown -- still safe-listed with passing CI
      classification="RECOMMEND"
      decision="comment"
      reason="safe-listed, CI passing, cooldown unknown"
    else
      classification="RECOMMEND"
      decision="comment"
      reason="not safe-listed or CI not passing"
    fi
  fi

  # Build result object
  result=$(jq -n \
    --argjson pr "$pr" \
    --arg classification "$classification" \
    --arg decision "$decision" \
    --arg reason "$reason" \
    --arg cooldown_status "$cooldown_status" \
    --arg publish_date "$publish_date" \
    --arg days_since_publish "$days_since_publish" \
    --arg package "$pkg" \
    --arg from_version "$from_ver" \
    --arg to_version "$to_ver" \
    --arg ecosystem "$ecosystem" \
    --argjson is_safe "$is_safe" \
    --argjson is_major "$is_major" \
    '{
      number: $pr.number,
      title: $pr.title,
      url: $pr.url,
      ci_status: $pr.ci_status,
      age_days: $pr.age_days,
      package: $package,
      from_version: $from_version,
      to_version: $to_version,
      ecosystem: $ecosystem,
      is_safe_listed: $is_safe,
      is_major_bump: $is_major,
      classification: $classification,
      decision: $decision,
      reason: $reason,
      cooldown: {
        status: $cooldown_status,
        publish_date: $publish_date,
        days_since_publish: (if $days_since_publish == "" then null else ($days_since_publish | tonumber) end),
        required_days: (if $classification == "MANUAL" then null else '"$COOLDOWN_DAYS"' end)
      }
    }' | jq --argjson cd "$COOLDOWN_DAYS" '.cooldown.required_days = (if .classification == "MANUAL" then null else $cd end)')

  results=$(echo "$results" | jq --argjson r "$result" '. + [$r]')

  echo "    -> $classification ($reason)"
done

# Write output
echo "$results" | jq '.' > "$OUTPUT_FILE"

# Print summary
safe_count=$(echo "$results" | jq '[.[] | select(.classification == "SAFE")] | length')
pending_count=$(echo "$results" | jq '[.[] | select(.classification == "COOLDOWN_PENDING")] | length')
recommend_count=$(echo "$results" | jq '[.[] | select(.classification == "RECOMMEND")] | length')
manual_count=$(echo "$results" | jq '[.[] | select(.classification == "MANUAL")] | length')

echo ""
echo "Dependabot review complete: ${safe_count} SAFE, ${pending_count} COOLDOWN_PENDING, ${recommend_count} RECOMMEND, ${manual_count} MANUAL"
echo "Written to $OUTPUT_FILE"
