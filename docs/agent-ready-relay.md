# Make fx-private-relay agent-ready

**Status:** Draft for Privacy Services eng review
**Timeline:** Q4 2026, six one-week tasks
**Ask:** One engineer for six weeks

## Summary

Coding agents can already write code for Relay. An agent can do even better work when it can understand the code, run it, check its own changes, and stay inside safe limits. When it can't, engineers spend their time reviewing slop and fixing mistakes.

This workstream improves the Relay code-base for coding agents. We will measure success in three ways:

- **Agent success.** How often an agent can take a ticket to a passing, mergeable PR.
- **Engineer time.** How much human review each PR needs.
- **Product quality**. Change failure rate, sentry issues, user bugs and cx reports should hold steady.

## What agent-ready means for Relay

1. **Understand the code.** An agent can read docs that state Relay's timeless rules - e.g., "never expose a user's real address." - and then tell an agent how to get current accurate knowledge from the code itself.
2. **Run the code.** An agent can install, run, and test Relay inside its sandbox, with no manual setup.
3. **Check its own work.** Tests, linters, and a code review run before a PR opens, and the agent fixes what they find.
4. **Stay in bounds.** CI blocks Relay-specific mistakes. High-risk paths always get a human.

## Why now

- **The models, tools, and techniques are mature**. See ["Scaling agentic coding across your organization" (PDF)](https://resources.anthropic.com/hubfs/Scaling%20agentic%20coding%20across%20your%20organization.pdf?hsLang=en)
- **Anthropic shows the payoff.** Their Claude Code team writes about 90% of its code with AI. Over three months, they doubled their merged PRs and cut reverts by 40%. They did it by moving checks from people to machines. ([Solving code review at Anthropic](https://claude.dev/blog/solving-code-review-at-anthropic/))
- **The FxA team** size decreased from 7 to 6 but our velocity-per-hour has doubled, and they credit [their FxAgent](https://fxa-desktop-82056944052.us-central1.run.app/) for that.

## How we measure ROI

We record a baseline in week 1, before any other change lands. We measure again in week 6. We report four numbers:

1. **Benchmark score.** We task an agent to complete 5 recently closed MPP tickets, starting on the commit before our fix merged. We score how many end with green CI and a PR we would merge without code edits.
2. **Human review per PR.** Approvals, review comments, and time from open to merge.
3. **Dependabot PRs merged with no human review.**
4. **Change failure rate.** Revert commits and stage-fix releases. Baseline for April to October 2026: 1 revert, and 3 stage-fixes out of 19 release tags.

We will also track Claude spend and engineer time. To count agent work, we will add an `agent-authored` label to PRs. **Main risk:** AI review in CI depends on Mozilla's plan and the Actions allowlist, which we don't control. We ask in week 1. If approval stalls, the local `/code-review` step still gets most of the benchmark value.

---

## Proposed Jira epic

**Epic:** Make fx-private-relay agent-ready (Q4 2026)

**Done when:**

- The benchmark score improves from week 1 to week 6.
- Patch Dependabot updates to dev dependencies continue to merge without human review when their checks pass.
- Change failure rate is no worse than the baseline.

### Tasks, in priority order

**1. Record the baseline** (Week 1)

- Create a benchmark script. Run the first benchmark, and add the `agent-authored` label to the PRs.
- Create `REVIEW.md` and `CODEOWNERS` for high-risk paths with relay eng team.
- Create a risk tier list, and add "Risk" and "How to revert" fields to the pr template.

**2. Agents can run and check Relay** (Week 2)

- Land [MPP-4821](https://mozilla-hub.atlassian.net/browse/MPP-4821).
- Add a hook that formats each edited file.
- Extend `pr-ready` to run tests and a new review script for code and security review, then fix what it finds.

**3. Agents get accurate context** (Week 3)

- Audit `CLAUDE.md` and `.agents/*.md`, remove stale rules, and write Relay's privacy and security rules there.
- Add a short codebase map, and keep agents out of generated files.

**4. CI catches Relay-specific mistakes** (Week 4)

- Fail CI when a model change has no migration, or when the API schema changes without updating `docs/api_schema.yaml`.
- Test the known leak paths, such as bounce forwarding, for exposure of a user's real address.
- Write `SECURITY_REVIEW.md` with Relay's security and privacy checks. The review script reads it and `REVIEW.md`.

**5. Review effort matches risk** (Week 5)

- Run the same review script in our own GitHub Actions job, and post findings as PR comments. High-severity security findings block the merge. The provider is a setting, so Claude or OpenAI works.

**6. Rerun the benchmark and report** (Week 6)

- Rerun the benchmark and metrics scripts, and report against the baseline.

**Later in Q1 and beyond:** an MPP ticket template, browser tests on PRs, a migration linter, skills for common Relay tasks, LSP plugins, a PR-gate hook, a post-deploy smoke test, and multi-pass review with finding verification.
