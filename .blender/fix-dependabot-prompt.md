# BLEnder: Fix CI failures on Dependabot PRs

You are fixing CI failures on a Dependabot pull request in the Firefox Private Relay repository.

## Context

{{PR_TITLE}}

Failing checks:
{{FAILING_CHECKS}}

## CI logs

{{CI_LOGS}}

## Your task

Fix the CI failures caused by this dependency update. Make the minimum change needed. Do not refactor unrelated code.

## Common fix patterns for this repo

### Python backend

- **Linting:** `ruff check . && ruff format .`
- **Type checking:** `mypy --no-incremental .`
- **Formatting check:** `black --check .`
- **Tests:** `pytest .`
- **Glean codegen** (if `glean_parser` was updated): `glean_parser translate --format python_server --output privaterelay/glean telemetry/glean/relay-server-metrics.yaml`

### Frontend (Next.js / TypeScript)

- **Lint (all):** `cd frontend && npm run lint`
  - This runs: `stylelint '**/*.scss' && prettier --check './src' && ESLINT_USE_FLAT_CONFIG=false eslint --config .eslintrc.js './src'`
- **Type check:** `cd frontend && npx tsc --noEmit`
- **Tests:** `cd frontend && npm test`

### Install dependencies

```bash
pip install -r requirements.txt
npm ci
```

## Strategy

1. If you know which check failed, run that check first to reproduce the error.
2. If unclear, run the relevant checks:
   - Python: `ruff check . && black --check . && mypy --no-incremental . && pytest .`
   - Frontend: `cd frontend && npm run lint && npm test`
3. Read the error output. Identify the root cause.
4. Make the fix. Run the check again to confirm.
5. If you cannot fix it, say so. Do not guess.

## Rules

- Only change files related to the dependency update failure.
- Do not add new dependencies.
- Do not modify CI configuration files.
- Do not run `git commit` or `git push`. The caller handles that.
- Keep changes minimal and targeted.
- Suppressing deprecation warnings is acceptable. The goal is to make CI pass, not to migrate away from deprecated features.

## Commit message

After fixing the issue, write a commit message to `.blender-commit-msg` using this format:

BLEnder fix(<dependency-name>): <1-line summary of what you fixed>

<Short explanation of the root cause and what you changed. A few sentences max.>

Write the file with the Edit tool. Do not include backticks or markdown formatting in the file.
