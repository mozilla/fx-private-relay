# Relay agent evals

Each folder here is one eval case. Each eval case is:

- A previously-closed ticket
- The commit before the ticket was fixed
- The test code that verifies the fix worked

They run on [Harbor](https://github.com/harbor-framework/harbor), the same harness for [Terminal-Bench](https://www.tbench.ai/).

## Run them

You need Docker running, and Harbor:

```
uv tool install harbor
export HARBOR_TELEMETRY=0
```

We check every case's fix against the reference fix - i.e., the fix from the commit that closed the ticket.
We store this reference fix in `solution/`. Harbor includes an "[oracle agent](https://deepwiki.com/harbor-framework/harbor/4.4-oracle-agent)" that applies each case's
`solution/`. It's not really an LLM agent, so every case should score 1.0, with 0 regressions and it costs nothing.

```
harbor run -p .agents/evals --agent oracle --jobs-dir /tmp/relay-eval-jobs
```

Then we run Claude Code on every case. Export a token from `claude setup-token` first. Never put
the token on the command line, where your shell history keeps it.

TODO: Figure out a better authentication mechanism.

```
export CLAUDE_CODE_OAUTH_TOKEN=...
harbor run --config .agents/evals/claude-code.yaml
```

`claude-code.yaml` follows Harbor example config format for runs, environment, agents, etc.
A run costs about $1 to $1.50 and takes 5 to 12 minutes.

Results land in `/tmp/relay-eval-jobs/<job>/`. `harbor view /tmp/relay-eval-jobs` shows them.

## Read the scores

The verifier (`_lib/verify.sh`) writes these to `reward.json`:

| Score           | What it means                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`        | Share of the fail-to-pass tests that pass, with the fix's tests as written.                                                                                 |
| `relaxed`       | The same, with asserts on choices the ticket never asked for swapped out: a format, a helper's name, a message's wording. Only cases that need it have one. |
| `*_regressions` | Tests that passed before the agent's change and fail after it.                                                                                              |
| `patch_applied` | 1 if the agent's change applied cleanly for scoring.                                                                                                        |

Watch `relaxed` when a case has it, else `strict`. Strict alone can fail a correct fix that
made a different incidental choice than the human did.

A judge agent also scores each run against the case's rubric. Harbor has no judge, so the judge lives
in [fxa-sandbox-ctl](https://github.com/vbudhram/fxa-sandbox-ctl):

```
eval.sh --harbor .agents/evals/<case> /tmp/relay-eval-jobs/<job>/<trial>
```

Agent results vary run to run. E.g., on MPP-4770, three runs scored 9 of 19 on relaxed and 10 of
13 from the judge each time, but strict ranged from 3 to 9, and cost and time varied by more
than two times. Compare setups over several runs and several cases, never one.

## What a case holds

A case holds only what is its own. The shared steps live once, in `_lib/`:

```
_lib/
  seal.sh            builds the agent's copy of the repo (below)
  verify.sh          runs the hidden tests through environment.yml's test command; writes reward.json
  solve.sh           applies solution/solution.patch, for the oracle
<case>/
  task.toml          resources, timeouts, healthcheck; [metadata] holds the fix and the judge's rubric
  instruction.md     the ticket, and all the agent sees
  environment/
    Dockerfile       the base's Python, BASE and SETUP_REF, then _lib/seal.sh
  tests/
    test.sh          one line: runs _lib/verify.sh
    strict_tests.py  the fix's tests, hidden from the agent
    relaxed_tests.py optional: the same, with incidental asserts swapped out
    hidden_target    where the hidden tests go in the repo
    f2p.txt          the tests the fix turns from failing to passing
  solution/
    solve.sh         one line: runs _lib/solve.sh
    solution.patch   the reference fix
```

The Dockerfile fetches `_lib/seal.sh` from GitHub at `SETUP_REF`. `seal.sh` builds the agent's
copy of the repo inside the image:

1. A shallow fetch of the base commit from GitHub, with 50 commits of history and nothing newer.
2. The agent setup from `SETUP_REF`, committed on top. `.agents/evals/` is removed, so the
   agent never sees a case. `verify.sh`, `solve.sh` and `.agents/environment.yml` come from
   the same commit.
3. The setup commit is dropped and the clone is garbage collected, so the fix is not there to find.
4. `.agents/environment.yml`'s build step runs. Its ready step becomes the task's healthcheck,
   and its test step is what `verify.sh` runs.

To measure another setup, change `SETUP_REF` in the case's Dockerfile. `_lib/` comes from that
ref too, so when you compare two setups, keep `_lib/` the same in both. A push to `SETUP_REF`
can take a few minutes to reach `raw.githubusercontent.com`.

## Add a case

1. Pick a closed ticket whose fix a person wrote and that changed tests.
2. Copy an existing case folder. Set `BASE` in its Dockerfile to the fix's merge commit's first
   parent, and `base_commit` and `fix_commit` in `task.toml`. Set the Dockerfile's `FROM` to the
   Python the base commit's own `Dockerfile` names (`git show <base>:Dockerfile | grep 'FROM python'`),
   so the tests run on the Python production ran then.
3. Put the ticket text in `instruction.md`. Keep the last line, which names the test command.
   `.prettierignore` keeps the hook from reformatting it: the ticket must stay as written.
4. Put the fix's code changes in `solution/solution.patch`: `git diff <base> <fix> -- <files>`.
5. Put the fix's test file in `tests/strict_tests.py`, and set `tests/hidden_target` to its path.
   If an assert pins a choice the ticket never asked for, add a `tests/relaxed_tests.py` without it.
6. List the fail-to-pass tests in `tests/f2p.txt`: those that fail at the base and pass with the fix.
7. Write a rubric in `task.toml`'s `[metadata]`.
8. Run the oracle on the new case. It must score 1.0, with 0 regressions.

## Known gaps

- The verifier runs in the agent's container. `harbor lint` flags this as `shared-verifier`.
- The agent has open network access. The tool block list is the only guard.
- Runs are one-shot. The agent cannot ask a question and get an answer.
