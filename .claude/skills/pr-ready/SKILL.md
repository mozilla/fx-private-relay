---
name: pr-ready
description: Run pre-commit checks, review PR checklist, and draft a commit message for Relay changes
tags: [git, pr, lint, relay]
---

# PR Ready

Get changes ready to submit as a PR. Runs lint checks, reviews the PR checklist, and drafts a commit message.

## Step 1: Run pre-commit checks

```bash
cd frontend && npx --no-install lint-staged --cwd ..
```

This runs stylelint, prettier, eslint, black, mypy, and ruff on staged files. Fix any errors before continuing.

## Step 2: Review PR checklist

Inspect `git diff --cached` (or `git diff HEAD` if nothing staged) and answer each item:

- **l10n**: Do changes touch any user-visible strings? If yes, have they been submitted to the l10n repo?
- **Tests**: Does the change fix a bug? If yes, is there a unit test to prevent regression?
- **Docs**: Do changes affect architecture, APIs, or workflows? If yes, is `docs/` updated?
- **UI**: Do any UI changes follow the [coding standards](../../docs/coding-standards.md)?
  - Protocol/Nebula colors used (see `/frontend/src/styles/colors.scss`)
  - CSS classes use `mzp-` prefix for Protocol, no prefix for custom styles
  - Simple selectors, minimal nesting, `//` comments in Sass
  - ESLint and stylelint rules satisfied

Report the checklist status. Flag any items that need attention before the PR is submitted.

## Step 3: Draft a conventional commit message

Review the staged changes and write a commit message. Do NOT run `git commit`.

**Format:**

```
<type>[optional scope]: <description>

[optional body]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`

**Style:**

- Short, declarative first line
- Active verbs, concrete nouns, no adverbs
- Body explains WHY, not what
- Breaking changes: use `feat!:` or `feat(scope)!:` + `BREAKING CHANGE:` footer

Present the message. Do not commit.

## Step 4: Draft "How to test:" section

Write a brief testing guide for the PR reviewer. Base it on the staged changes.

**Format:**

```
How to test:
1. <setup step, if needed>
2. <action to take>
3. <what to verify>
```

**Guidelines:**

- Start with any required setup (flag, env var, account state)
- Describe the specific action a reviewer must take
- State the expected outcome — what they should see or not see
- Cover the happy path first, then edge cases if the change warrants it

Present the section. Do not open a PR.
