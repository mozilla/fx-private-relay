#!/usr/bin/env bash
# One test entry point for developers, agents and evals.
#
#   scripts/test-env.sh [pytest args...]   set up if needed, then run pytest
#   scripts/test-env.sh --setup            set up only
#   scripts/test-env.sh --check            check that settings load the emails app
#
# Evals copy this script onto old commits, so it reads only files every commit
# has: Dockerfile, requirements.txt, .env-dist and .gitmodules.
#
# It exports the .env-dist values rather than writing .env, because agent
# sandboxes deny reading .env files. Variables the caller already set win, as
# they do for python-decouple. Values in a local .env do not: the exported
# .env-dist values override them, so tests match CI.
set -euo pipefail

cd "$(dirname "$0")/.."
VENV=.venv-test

die() {
  echo "test-env.sh: $*" >&2
  exit 1
}

python_version() {
  # Dockerfile has two FROM lines (node, then python). Take the python one.
  # uv gets major.minor, since its downloads may not have the exact patch.
  local full
  full="$(sed -n 's/^FROM python:\([0-9][0-9.]*\).*/\1/p' Dockerfile | head -n 1)"
  [ -n "$full" ] || die "found no 'FROM python:' line in Dockerfile"
  echo "${full%.*}"
}

export_env_dist() {
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    # A value may be quoted, and may hold spaces (INTERNAL_IPS does).
    if [[ "$val" =~ ^\"(.*)\"$ || "$val" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    [ -n "${!key+x}" ] || export "$key=$val"
  done < .env-dist
  export DATABASE_URL="${DATABASE_URL:-sqlite:///db.sqlite3}"
}

setup_python() {
  local version stamp
  version="$(python_version)"
  stamp="$version $(git hash-object requirements.txt)"
  if [ -x "$VENV/bin/python" ] && [ "$(cat "$VENV/.stamp" 2>/dev/null)" = "$stamp" ]; then
    return
  fi
  command -v uv > /dev/null \
    || die "needs uv. Install it: https://docs.astral.sh/uv/getting-started/installation/"
  echo "test-env.sh: building $VENV with Python $version" >&2
  uv venv --quiet --allow-existing --python "$version" "$VENV"
  uv pip install --quiet --python "$VENV/bin/python" -r requirements.txt
  echo "$stamp" > "$VENV/.stamp"
}

setup_locales() {
  if [ -n "$(ls -A privaterelay/locales 2> /dev/null)" ]; then
    return
  fi
  echo "test-env.sh: fetching the privaterelay/locales submodule" >&2
  git submodule update --init privaterelay/locales \
    || die "could not fetch the privaterelay/locales submodule; tests that render strings would fail"
}

setup_static_stubs() {
  # The same files CI makes in python-checks.yml.
  mkdir -p job-results staticfiles/accounts/profile frontend/out/accounts/profile
  touch staticfiles/accounts/profile/index.html frontend/out/accounts/profile/index.html
}

setup() {
  setup_python
  setup_locales
  setup_static_stubs
}

use_venv() {
  export VIRTUAL_ENV="$PWD/$VENV"
  export PATH="$VIRTUAL_ENV/bin:$PATH"
}

check() {
  [ -x "$VENV/bin/python" ] || die "$VENV is missing; run scripts/test-env.sh --setup first"
  # Before manage.py check: without the emails app, check fails on a migration
  # error that does not name the cause.
  python - << 'EOF' || exit 1
import sys

import django

django.setup()
from django.apps import apps

if not apps.is_installed("emails"):
    sys.exit(
        "test-env.sh: settings.py dropped the emails app; it does that when"
        " AWS_SES_CONFIGSET or AWS_SNS_TOPIC is empty."
    )
EOF
  # On a fresh SQLite file, check warns about every unapplied migration, so
  # show its output only when it fails.
  local out
  out="$(python manage.py check 2>&1)" || {
    echo "$out" >&2
    die "manage.py check failed"
  }
  echo "test-env.sh: ready" >&2
}

export_env_dist
use_venv
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-privaterelay.settings}"

case "${1:-}" in
  --setup)
    setup
    ;;
  --check)
    check
    ;;
  *)
    setup
    exec pytest "$@"
    ;;
esac
