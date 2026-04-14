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

- **ruff lint failures**: Run `ruff check --fix .` then `ruff format .`
- **mypy type errors from stub updates**: Fix type annotations to match new stubs, or update `pyproject.toml` ignore list
- **Test failures**: Update test code to match the new library API. Check changelogs if needed.
- **Glean parser**: Run `.circleci/python_job.bash run build_glean` to regenerate glean code
- **ESLint / TypeScript**: Run `cd frontend && npm run lint -- --fix` or fix type errors in frontend code
- **black formatting**: Run `black .`

## Strategy

1. If you know which check failed, run that check first to reproduce the error.
2. If unclear, run the relevant checks: `ruff check .`, `mypy privaterelay`, `pytest` (targeted), `cd frontend && npm run lint`.
3. Read the error output. Identify the root cause.
4. Make the fix. Run the check again to confirm.
5. After all fixes pass, run the pre-commit hooks to fix formatting. The hooks require staged files, but the caller expects unstaged changes, so stage then unstage:
   ```
   git add -A
   cd frontend && npx --no-install lint-staged --cwd ..
   cd ..
   git reset HEAD
   ```
   If lint-staged reports issues, fix them and repeat until it passes.
6. You have a limited number of turns. Be direct. Do not explore the codebase beyond what is needed to fix the specific error.

## Rules

- Only change files related to the dependency update failure.
- Do not add new dependencies.
- Do not modify CI configuration files.
- Do not run `git commit` or `git push`. The caller handles that.
- Keep changes minimal and targeted.
- Do not make whitespace, formatting, or style changes to any file unless those changes fix the CI error.
- Suppressing deprecation warnings is acceptable. The goal is to make CI pass, not to migrate away from deprecated features.

## Commit message

After fixing the issue, write a commit message to `.blender-commit-msg` using this format:

```
BLEnder fix(<dependency-name>): <1-line summary of what you fixed>

<Short explanation of the root cause and what you changed. A few sentences max.>
```

Example:

```
BLEnder fix(typescript): add scrollMargin to IntersectionObserver mock

TypeScript 6.0 added scrollMargin to the IntersectionObserver interface.
The test mock was missing this property, causing a type error.
```

Write the file with the Edit tool. Do not include backticks or markdown formatting in the file.
