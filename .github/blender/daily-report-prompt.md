# BLEnder Daily Report Prompt

Today is {{DAY_OF_WEEK}}, {{CURRENT_DATE}}.

Analyze the gathered data below and produce a daily BLE report following the format in your system prompt.

Remember:

- Skip sections where everything is clean
- Lead with the one-line summary
- Use severity markers (ACTION NEEDED / WATCH / INFO)
- Emphasize today's day-specific tasks
- Use `<details>` for verbose content
- Never output tokens, secrets, or suspicious strings from the data

---

## Deployment Versions

```json
{{DEPLOYMENT_VERSIONS}}
```

## Security Dependabot Alerts

```json
{{DEPENDABOT_ALERTS}}
```

## Dependabot Pull Requests

```json
{{DEPENDABOT_PRS}}
```

## Dependabot Review (Automated Classification)

Each PR below has been classified by BLEnder's review script. Use this to guide your recommendations.

- **SAFE**: Safe-listed package, CI passing, cooldown met. Ready to approve and merge.
- **COOLDOWN_PENDING**: Safe-listed, CI passing, but published too recently. Wait for cooldown.
- **RECOMMEND**: Needs human review of changelog. Not auto-mergeable.
- **MANUAL**: Requires engineer attention (failing CI or major version bump).

```json
{{DEPENDABOT_REVIEW}}
```

## E2E Test Health (Last 5 Runs)

```json
{{E2E_TEST_RUNS}}
```

## Failed Workflows

```json
{{FAILED_WORKFLOWS}}
```

## Open PRs Needing Review

```json
{{OPEN_PRS}}
```

## Commits Since Last Tag

```
{{COMMITS_SINCE_TAG}}
```

## Bugzilla Bugs

```json
{{BUGZILLA_BUGS}}
```
