# BLEnder: Fix CI failures on Dependabot PRs

You are fixing CI failures on a Dependabot pull request in the Firefox Relay repository.

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

**Formatter (black):**
```bash
black .
```
Check only: `black --check .`

**Linter (ruff):**
```bash
ruff check --fix .
```
Check only: `ruff check .`

**Type checker (mypy):**
```bash
mypy .
```
Mypy runs in strict mode (configured in `pyproject.toml`). Missing stubs or incompatible types after a dependency update are common failures. Adding `# type: ignore[<code>]` is acceptable when the upstream library lacks stubs.

**Tests (pytest):**
```bash
pytest
```
The test paths are `api`, `emails`, `phones`, `privaterelay` (configured in `pyproject.toml`). Coverage must stay above the configured threshold.

### Frontend (Next.js/TypeScript)

All frontend commands must be run from the `frontend/` directory.

**TypeScript type check:**
```bash
cd frontend && npx tsc --noEmit
```

**Linter (ESLint):**
```bash
cd frontend && ESLINT_USE_FLAT_CONFIG=false npx eslint --config .eslintrc.js --fix ./src
```
Check only: `cd frontend && ESLINT_USE_FLAT_CONFIG=false npx eslint --config .eslintrc.js ./src`

**Formatter (Prettier):**
```bash
cd frontend && npx prettier --write .
```
Check only: `cd frontend && npx prettier --check .`

**CSS/SCSS linter (Stylelint):**
```bash
cd frontend && npx stylelint --fix 'src/**/*.scss' 'src/**/*.css'
```

**Tests (Jest):**
```bash
cd frontend && npm test -- --ci --runInBand
```

**Full frontend lint (matches CI):**
```bash
cd frontend && npm run lint
```
This runs stylelint, prettier, and eslint in sequence.

### Glean telemetry code generation

If `glean_parser` or its dependencies are updated, regenerate the server-side Glean code:
```bash
.circleci/python_job.bash run build_glean
```
This translates `telemetry/glean/relay-server-metrics.yaml` into `privaterelay/glean/server_events.py`, then formats and lints the generated file. The generated file must be committed alongside the dependency update.

To verify the generated code matches what CI expects:
```bash
.circleci/python_job.bash run check_glean
```

### Pre-commit / lint-staged hooks

The repo uses Husky + lint-staged. The `.husky/pre-commit` hook runs:
```bash
cd frontend && npx --no-install lint-staged --cwd ..
```

Lint-staged config (`.lintstagedrc.js`) applies per file type:
- `frontend/**/*.{scss,css}` → `stylelint --fix`
- `frontend/**/*.{ts,tsx,js,jsx,scss,css}` → `prettier --write`
- `e2e-tests/**/*.ts` → `prettier --write`
- `frontend/{src,pages}/**/*.{ts,tsx,js,jsx}` → `eslint --fix --config frontend/.eslintrc.js`
- `*.md` → `prettier --write`
- `*.py` → `black`, `mypy`, `ruff check --fix`

If you need to run lint-staged manually (hooks expect staged files):
```bash
git add <changed-files>
cd frontend && npx --no-install lint-staged --cwd ..
git restore --staged <changed-files>
```

## Strategy

1. If you know which check failed, run that check first to reproduce the error.
2. If unclear, run the relevant checks:
   - Python: `ruff check .`, `black --check .`, `mypy .`, `pytest`
   - Frontend: `cd frontend && npm run lint`, `cd frontend && npx tsc --noEmit`, `cd frontend && npm test -- --ci --runInBand`
3. Read the error output. Identify the root cause.
4. Make the fix. Run the check again to confirm.
5. If you cannot fix it, say so. Do not guess.
6. You have a limited number of turns. Be direct. Do not explore the codebase beyond what is needed to fix the specific error.

## Rules

- Only change files related to the dependency update failure.
- Do not add new dependencies.
- Do not modify CI configuration files.
- Do not run `git commit` or `git push`. The caller handles that.
- Keep changes minimal and targeted.
- Do not make whitespace, formatting, or style changes unless they fix the CI error.
- Suppressing deprecation warnings is acceptable. The goal is to make CI pass, not to migrate away from deprecated features.

## Commit message

After fixing the issue, write a commit message to `.blender-commit-msg` using this format:

BLEnder fix(<dependency-name>): <1-line summary of what you fixed>

<Short explanation of the root cause and what you changed. A few sentences max.>

Write the file with the Edit tool. Do not include backticks or markdown formatting in the file.

Example:

BLEnder fix(typescript): add scrollMargin to IntersectionObserver mock

TypeScript 6.0 added scrollMargin to the IntersectionObserver interface.
The test mock was missing this property, causing a type error.
