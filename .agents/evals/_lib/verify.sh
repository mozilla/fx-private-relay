#!/bin/bash
# verify.sh: score the agent's change with a case's hidden tests, SWE-bench style, through the
# repo's own test command. Each case's tests/test.sh runs it. Writes /logs/verifier/reward.json.
#
# A case's tests/ holds strict_tests.py (the fix's tests as written) and, when the fix's tests
# pin a choice the ticket never asked for (a format, a helper's name, a message's wording),
# relaxed_tests.py (the same tests with those asserts swapped out). Each gives a score:
#   <name>              the share of the fail-to-pass units (f2p.txt) that pass
#   <name>_passed       how many pass
#   <name>_regressions  tests that passed at the start and fail after the agent's change
set -uo pipefail
EVAL="${EVAL:-/opt/eval}" L=/logs/verifier
cd "${DEST:-/app}" || exit 1
mkdir -p "$L"
start="$(cat "$EVAL/start")" target="$(cat /tests/hidden_target)" tcmd="$(cat "$EVAL/test_command")"

# 1. The agent's change, commits and new files included, as one patch from the start.
git add -A && git diff --cached --binary "$start" > "$L/model.patch"
git reset -q

# run <name> <log>: one copy of the hidden tests in place, run through the repo's test command.
run() {
  cp "/tests/$1_tests.py" "$target"
  bash -c "$tcmd \"\$@\"" _ "$target" -q -p no:cacheprovider -rA > "$L/$2.txt" 2>&1 || true
}
variants=(strict)
[ -f /tests/relaxed_tests.py ] && variants+=(relaxed)

# 2. The baseline: the start state, with what the build made left in place.
git reset -q --hard "$start" && git clean -fdq
for v in "${variants[@]}"; do run "$v" "baseline-$v"; done

# 3. The agent's state.
git reset -q --hard "$start" && git clean -fdq
applied=1
if [ -s "$L/model.patch" ]; then
  git apply --binary --whitespace=nowarn "$L/model.patch" 2> "$L/apply.err" || applied=0
fi
for v in "${variants[@]}"; do run "$v" "$v"; done

python3 - "$L" "$applied" "${variants[@]}" << 'EOF'
import json, re, sys
L, applied, variants = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
f2p = [u.strip() for u in open("/tests/f2p.txt") if u.strip()]

def failed(path):
    out, text = set(), open(path, errors="replace").read()
    for line in text.splitlines():
        m = re.match(r"^SUBFAILED\[([^]]*)\] (\S+)", line)
        if m:
            out.add(f"{m.group(2)}[{m.group(1)}]")
            continue
        m = re.match(r"^(FAILED|ERROR) (\S+)", line)
        if m:
            out.add(m.group(2))
    collected = "error during collection" not in text and "no tests ran" not in text
    return out, collected

reward, detail = {"patch_applied": applied}, {}
for v in variants:
    now, ok = failed(f"{L}/{v}.txt")
    base, base_ok = failed(f"{L}/baseline-{v}.txt")
    passed = sum(1 for u in f2p if ok and u not in now and u.split("[")[0] not in now)
    regressions = sorted(now - set(f2p) - base) if base_ok else None
    reward[v] = round(passed / len(f2p), 4) if f2p else 0
    reward[f"{v}_passed"] = passed
    reward[f"{v}_regressions"] = len(regressions) if regressions is not None else -1
    detail[v] = {"collected": ok, "passed": passed, "total": len(f2p), "regressions": regressions}
json.dump(reward, open(f"{L}/reward.json", "w"))
json.dump(detail, open(f"{L}/score-detail.json", "w"), indent=1)
print(json.dumps(detail))
EOF
