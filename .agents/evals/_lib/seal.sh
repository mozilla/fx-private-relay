#!/bin/bash
# seal.sh: build the agent's copy of the repo for one eval case. Each case's Dockerfile fetches
# this file from SETUP_REF and runs it as one RUN step, so no layer keeps what it drops.
#
#   REPO        owner/name on GitHub
#   BASE        the commit before the fix
#   SETUP_REF   the agent setup under test (AGENTS.md, CLAUDE.md, .agents/, .claude/)
#   DEST        the agent's copy (default /app); EVAL the eval files (default /opt/eval)
#
# 1. A shallow fetch of BASE: the base and DEPTH commits below it, nothing newer.
# 2. The setup from SETUP_REF, committed on top. .agents/evals/ is removed, so no case is visible.
#    This file's neighbours (verify.sh, solve.sh) and .agents/environment.yml come from there too.
# 3. The setup commit is dropped and the clone garbage collected, so the fix is not there to find.
# 4. .agents/environment.yml's build step runs; its ready and test steps are saved for the task.
set -euo pipefail
: "${REPO:?}" "${BASE:?}" "${SETUP_REF:?}" "${DEST:=/app}" "${EVAL:=/opt/eval}" "${DEPTH:=50}"
url="${REPO_URL:-https://github.com/$REPO}"   # REPO_URL: a local clone, to test this script without Docker

if [ -z "${EVAL_SKIP_APT:-}" ]; then
  apt-get update -q && apt-get install -y -q --no-install-recommends git ca-certificates curl > /dev/null
  rm -rf /var/lib/apt/lists/*
  git config --global user.name "Eval agent" && git config --global user.email eval@invalid
  git config --global --add safe.directory "$DEST"
fi
mkdir -p "$EVAL"

git init -q -b main "$DEST" && cd "$DEST"
git fetch -q --depth="$DEPTH" --no-tags "$url" "$BASE"
git checkout -q -B main FETCH_HEAD
git fetch -q --depth=1 --no-tags "$url" "$SETUP_REF"
setup="$(git rev-parse FETCH_HEAD)"

# The eval files and the repo's environment, from the setup commit.
for f in verify.sh solve.sh; do git show "$setup:.agents/evals/_lib/$f" > "$EVAL/$f"; done
chmod +x "$EVAL"/*.sh
git show "$setup:.agents/environment.yml" > "$EVAL/environment.yml"
# environment.yml names the commands; a command's first word with a slash is a repo file to keep.
uv run --quiet --no-project --with pyyaml python3 - "$EVAL" <<'EOF'
import sys, yaml
d = sys.argv[1]
env = yaml.safe_load(open(f"{d}/environment.yml"))
cmds = next(p["commands"] for p in env["providers"] if "commands" in p)
steps = {"build": cmds.get("build", ""), "ready": env["ready"], "test": env["test"]}
for name, cmd in steps.items():
    open(f"{d}/{name}_command", "w").write(cmd + "\n")
files = {c.split()[0] for c in steps.values() if c and "/" in c.split()[0]}
open(f"{d}/setup_paths", "w").write("".join(f"{f}\n" for f in sorted(files)))
EOF

# The setup under test, on the base.
for f in AGENTS.md CLAUDE.md .agents .claude $(cat "$EVAL/setup_paths"); do
  git cat-file -e "$setup:$f" 2> /dev/null || continue
  rm -rf "$f"
  git checkout -q "$setup" -- "$f"
done
rm -rf .agents/evals
git add -A
git -c user.name=Eval -c user.email=eval@invalid commit -qm "eval: agent setup from $SETUP_REF (${setup:0:10})" --allow-empty
git update-ref refs/remotes/origin/main "$BASE"
git rev-parse HEAD > "$EVAL/start"

# Forget the setup commit. Its whole tree came with it; only the files above stay.
rm -f .git/FETCH_HEAD
grep -vx "$setup" .git/shallow > .git/shallow.new || true
mv .git/shallow.new .git/shallow
git reflog expire --expire=now --all
git gc -q --prune=now
if git cat-file -e "$setup" 2> /dev/null; then
  echo "seal.sh: the setup commit is still in the clone" >&2
  exit 1
fi

# The repo's own build step. What it makes is not part of the agent's diff.
bash -c "$(cat "$EVAL/build_command")"
git ls-files -o --exclude-standard --directory | sed 's#^#/#' >> .git/info/exclude
printf '#!/bin/bash\ncd %s && %s\n' "$DEST" "$(cat "$EVAL/ready_command")" > "$EVAL/ready.sh"
chmod +x "$EVAL/ready.sh"
echo "sealed $(git rev-parse --short HEAD) on ${BASE:0:10}, setup ${setup:0:10}"
