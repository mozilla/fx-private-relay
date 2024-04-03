# Use Code Linters to Enforce Layout and Discover Issues

- Status: Informational
- Deciders: Luke Crouch
- Date: 2024-04-04

Technical Story: [MPP-79][]

[MPP-79]: https://mozilla-hub.atlassian.net/browse/MPP-79

## Context and Problem Statement

A linter is a static analysis tool that find bugs, style issues, and suspicious
constructs. Some of the areas addressed by different linting tools include:

- **Enforce Layout** - Checks (and often reformats) code to fit a project
  style. This helps make code and code changes easier to read and comprehend.
  It also allows new contributors to match the existing project style.
- **Check Types** - Verifies that code is using types consistently.
  This is especially useful for dynamic languages where incorrect type errors
  would lead to bugs or runtime exceptions.
- **Identify Mistakes** - Detects valid code that is often associated with a
  programming mistake. Some examples are identifying unused variables, and
  using loose equality in JavaScript.
- **Standardize Constructs** - Picks a way to express a concept, when the
  language allows several was to express it. Some examples are import order,
  or if default values should be specified by the caller.
- **Spelling and Grammar Checking** - Checks comments in a similar way to a
  word processor. Comments often use project-specific technical terms, making
  this a different task from checking English prose.

Most developers appreciate that linters make multi-developer projects easier.
The shared project standards can be checked and enforced by tools. Code
reviewers can focus on the logic of changes, rather than the form of the code.
A linter may identify an unexpected issue. A developer can read the linter
documentation to learn more about the issue. This is one way a developer can
improve their understanding of the project's languages.

On the other hand, developers resent changes to their working process,
especially when the benefits are unclear or they disagree with the trade-offs.
It becomes harder to add a tool as the lines of code and the number of team
members grow. The best time to incorporate linters is at the start of the
project. Relay did not, so adding these tools has been a slower, more
deliberate process.

## Decision Drivers

When picking a tool, there are some attributes to consider:

- **Good defaults** - If a tool has good default settings, it is more likely
  that it will need less project-specific configuration, and the project
  code will look like other projects.
- **Mark false positives** - There should be few false positives, where the
  tool identifies a problem but the code is OK. When there is a false
  positive, it should be possible to ignore it and get a passing check.
- **Fixes issues when appropriate** - A linter that enforces layout is more
  useful when it can re-write the source code to the correct layout. The
  alternative, only identifying layout issues, would make for a worse
  developer experience. In other cases, it is better to identify the issue and
  let the developer decide how to fix it.
- **Checks on pull request** - The tool need to run in the continuous integration
  (CI) environments, so that no failing code is merged to main.
- **Checks in the development environment** - It is easier to fix issues the
  sooner they are found. It should be easy to run the tool in the development
  environment. At a minimum, a developer should be able to run the tool once
  per commit, and a clean linter run should (almost always) result in a clean
  linter run in continuous integration.
- **Speed** - A faster tool will be run earlier in the development process. If
  a tool runs in a millisecond, it can be incorporated into the editor, similar
  to syntax highlighting. If a tool runs in 1/10 of a second, it can be run
  every time the file is saved. If a tool takes a minute to run, developers
  will disable it when committing and let CI run it.

## Linters Used By Relay

Relay has added several linters to check code quality:

|                        | CSS       | JavaScript       | Python | Markdown | Shell Scripts |
| :--------------------- | :-------- | :--------------- | :----- | :------- | :------------ |
| Enforce Layout         | prettier  | prettier, ESLint | black  | prettier | _none_        |
| Check Types            | stylelint | TypeScript       | mypy   | _n/a_    | _none_        |
| Identify Mistakes      | stylelint | ESLint           | _none_ | _none_   | _none_        |
| Standardize Constructs | stylelint | ESLint           | _none_ | _none_   | _none_        |
| Spelling and Grammar   | _none_    | _none_           | _none_ | _none_   | _none_        |

Relay includes [husky][] and [lint-staged][] to run linters as a pre-commit
hook. The linters configured in [.lintstagedrc.js][] run against the files
changed in each commit. When a tool supports fixing issues, it can update the
files before committing. Otherwise, detected issues will halt the commit,
giving the developer a chance to fix them.

[husky]: https://typicode.github.io/husky/
[lint-staged]: https://github.com/lint-staged/lint-staged
[.lintstagedrc.js]: https://github.com/mozilla/fx-private-relay/blob/main/.lintstagedrc.js

### stylelint

[stylelint][] is a CSS linter that identifies mistakes and standardizes
constructs. Relay uses a plugin to also check [SCSS/Sass][sass], an extended
syntax for CSS. The configuration file is at
[frontend/.stylelintrc.cjs][]. It was added July 2021.

stylelint has all six attributes of a useful linter:

- **Good defaults** - Stylelint has no linting rules enabled by default. However,
  the team ships a minimum [recommended config][stylelint-config-recommended].
  They extend it with a [standard config][stylelint-config-standard] to enforce
  common conventions. Relay uses [stylelint-config-recommended-scss][], and
  extends it with some customer rules.
- **Mark False Positives** - Developers can
  [disable a rule with a comment][stylelint-disable], and
  [ignore a file in the config][stylelint-ignore].
- **Fixes Issues when Appropriate** - The tool can fix some issues with the
  `--fix` option. Auto-fix can be turned off for individual rules.
- **Checks on Pull Request** - The command-line tool is used to check all `.scss`
  file for each pull request.
- **Checks in the Development Environment** - The tool is used in pre-commit
  checks in auto-fix mode. There is an official stylelint plugin for the VS
  Code editor, but it may duplicate or collide with the built-in CSS checks.
- **Speed** - The tool is fast enough to run on each file save.

[sass]: https://sass-lang.com/documentation/syntax/
[stylelint-config-recommended-scss]: https://github.com/stylelint-scss/stylelint-config-recommended-scss
[stylelint-config-recommended]: https://github.com/stylelint/stylelint-config-recommended
[stylelint-config-standard]: https://www.npmjs.com/package/stylelint-config-standard
[frontend/.stylelintrc.cjs]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.stylelintrc.cjs
[stylelint-disable]: https://github.com/mozilla/fx-private-relay/blob/6ca835d6ad69603fb80d23cdc12ba56aeeea1264/frontend/src/components/dashboard/aliases/Alias.module.scss#L215
[stylelint-ignore]: https://github.com/mozilla/fx-private-relay/blob/6ca835d6ad69603fb80d23cdc12ba56aeeea1264/frontend/.stylelintrc.cjs#L13
[stylelint]: https://stylelint.io/

### prettier

[prettier][] is a code formatter for several languages. Relay uses it to format
JavaScript, TypeScript, CSS, SCSS, and Markdown (in the frontend folder). There
is an empty configuration file at [frontend/.prettierrc.json][]. It was added
(again?) in December 2021.

prettier has all six attributes of a useful linter:

- **Good defaults** - The default configuration is used on Relay.
- **Mark False Positives** - prettier supports an ignore file, but this is
  unused on Relay.
- **Fixes Issues when Appropriate** - The `--write` option will reformat files,
  and supports wildcard patterns.
- **Checks on Pull Request** - The tool is used to check all files in
  `frontend/src` for each pull request.
- **Checks in the Development Environment** - The tool is used in pre-commit
  checks in write mode. There is an official prettier plugin for VS Code and
  other editors, and can be set to run on save.
- **Speed** - The tool is fast enough to run on each file save. It says it
  may be slow to run across an entire project.

[prettier]: https://prettier.io/
[frontend/.prettierrc.json]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.prettierrc.json

### TypeScript

[TypeScript][] extends JavaScript with type information. This can be used for
static checking of code, including finding errors like unknown variables. It is
compiled to JavaScript in a build step, mostly by removing the type hints. Relay
added TypeScript in March 2022 with the refactor to React / next.js.

TypeScript supports some of the attributes of a useful linter:

- **Good defaults** - The configuration at [frontend/tsconfig.json][] has a few
  customizations, many to work with next.js. Relay has enabled the strict mode,
  which turns on a default set of rules.
- **Checks on Pull Request** - The frontend application is built on each pull
  request, and fails on TypeScript errors.
- **Checks in the Development Environment** - A developer can run a service
  that watches for file changes and rebuilds the application. The `next lint`
  command runs during pre-commit and will check for TypeScript issues.
- **Speed** - The incremental build is fast enough to run on each file save.

[TypeScript]: https://www.typescriptlang.org/
[frontend/tsconfig.json]: https://github.com/mozilla/fx-private-relay/blame/main/frontend/tsconfig.json

### next lint / ESLint

Next.js [integrates with ESLint][nextjs-eslint]. It identifies mistakes and
standardizes constructs in JavaScript. Relay uses Next.js's base ESLint
configuration. A stricter rule set that checks against
[Google's Web Vitals][web-vitals] is also available. ESLint contains some
code formatting rules, and needs tuning to be compatible with prettier.
Relay has used ESLint since at least October 2020, and continued using it with
the next.js refactor in March 2022.

ESLint has all six attributes of a useful linter:

- **Good defaults** - Next.js provides a base and strict rule set. We've
  expanded [frontend/.eslintrc.js][] to support Relay's non-standard
  configuration (static HTML generation with a Django server rather than a
  next.js server).
- **Mark False Positives** - The configuration allows tuning rules to work with
  Relay's service architecture. ESLint does not have a way to ignore rules
  within a source file.
- **Fixes Issues when Appropriate** - The `--fix` option will change code.
- **Checks on Pull Request** - `next lint` is used to check all the frontend
  code for each pull request.
- **Checks in the Development Environment** - The tool is used in pre-commit
  checks in fix mode. There are editor integrations several editors including
  VS Code.
- **Speed** - The tool is fast enough to run on each file save.

[nextjs-eslint]: https://nextjs.org/docs/pages/building-your-application/configuring/eslint
[web-vitals]: https://web.dev/articles/vitals
[frontend/.eslintrc.js]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.eslintrc.js

### black

[black][] is a formatting tool to enforce layout of Python code. Relay adopted
it in May 2022.

black has all six attributes of a useful linter:

- **Good defaults** - black started with almost no options. As it has grown and
  added maintainers, it is now more flexible about formatting code and
  targeting a minimum Python version. It uses the standard [pyproject.toml][]
  for configuration. Relay uses the default configuration.
- **Mark False Positives** - black allows `# fmt` comments to ignore formatting
  for a section of code. Relay does not use this.
- **Fixes Issues when Appropriate** - The default is to reformat code, and
  report when a file changed due to reformatting
- **Checks on Pull Request** - `black --check` is used to check Python code
  formatting for each pull request.
- **Checks in the Development Environment** - The tool is used in pre-commit
  checks. It can be integrated into editors, including VS Code, to reformat
  the file on save.
- **Speed** - The tool is fast enough to run on each file save, as well as
  periodically against the entire codebase.

[black]: https://black.readthedocs.io/en/stable/index.html
[pyproject.toml]: https://github.com/mozilla/fx-private-relay/blob/main/pyproject.toml

### mypy

[mypy][] is a static type checker for Python. It can be used in strict mode,
helping a new project develop type-checked code. Relay added mypy support in
April 2022, using an optional checking configuration as appropriate for a
legacy project. The Relay team has added type hints to new code and gradually
ratcheted up the strictness.

mypy has some of the attributes of a useful linter:

- **Good defaults** - In strict mode, mypy will check types for all Python
  code. This can be challenging when working with legacy code or third-party
  libraries that do not ship type hints. The project has a guide
  [Using mypy with an existing codebase][mypy-legacy] which Relay used to guide
  the implementation.
- **Mark False Positives** - mypy allows ignoring third-party packages in
  the standard [pyproject.toml][] file. Relay uses this for
  third-party packages without type hints. Relay also disables strict rules
  that require many changes to legacy code. A comment `# type: ignore` can
  be used to ignore issues in code. The comment feature is not used by Relay.
- **Checks on Pull Request** - mypy is used to check Python types for each pull
  request.
- **Checks in the Development Environment** - The tool is used in pre-commit
  checks. It can be integrated into editors, including VS Code, to identify
  issues on save.
- **Speed** - The tool maintains a cache to make incremental type checking
  faster. It is occasionally necessary to use the `--no-incremental` option
  to detect issues that cross source files.

[mypy]: https://mypy.readthedocs.io/en/stable/
[mypy-legacy]: https://mypy.readthedocs.io/en/stable/existing_code.html

## Adding New Linters

Here is the linter chart again, focusing on areas without linters:

|                        | CSS    | JavaScript | Python | Markdown | Shell Scripts |
| :--------------------- | :----- | :--------- | :----- | :------- | :------------ |
| Enforce Layout         | yes    | yes        | yes    | yes      | **no**        |
| Check Types            | yes    | yes        | yes    | n/a      | **no**        |
| Identify Mistakes      | yes    | yes        | **no** | **no**   | **no**        |
| Standardize Constructs | yes    | yes        | **no** | **no**   | **no**        |
| Spelling and Grammar   | **no** | **no**     | **no** | **no**   | **no**        |

When deciding _if a linter is needed_, some criteria are:

- **Is the language used in production?** CSS, JavaScript, and Python are used
  in production. It is useful to find issues in this code before it is shipped
  to users. Markdown and Shell Scripts are used by developers, not users, so
  errors do not impact users directly, or at all.
- **What is the impact of issues detected by the linter?** The highest impact
  issues are user-facing bugs, and some tools address this directly. Often a
  linter's largest impact is to make code more uniform, which has a measurable
  impact on the speed and effectiveness of code reviews. Reviewers can spend
  time understanding the logic of code changes without the distraction of
  parsing non-standard code. A good code comment with a spelling error can
  still be understood by another developer. A perfectly formed but misleading
  comment should be deleted.

By these tests, we should not add new linters for Markdown and Shell Scripts
at this time, or add Spelling and Grammar linters. Individuals can use these
tools in development and code review, but it is not worth enforcing a tool
for all new code.

On the other hand, we should consider a Python linter that will identify
mistakes and standardize constructs. Python is used in production for the
web and API server, as well as background tasks. Errors in this code will
impact users, and non-standard code can slow down code reviews.

This document proposes six criteria for evaluating a linter. Some linters
that would fill this role:

- [pylint][] - This tool has been in development since 2003, and has
  hundreds of built-in checks, including layout enforcement and spelling
  checkers. It works across entire codebases instead of individual files. It
  identifies 2,800 issues in our code, in 25 seconds.
- [pycodestyle][] - This tool, formerly known as `pep8`, has been in
  development since 2006, and is focused on code formatting and some code
  constructs. It identifies 317 issues in our code in 1.5 seconds.
- [pyflakes][] - This tool has been in development since 2009, targeted
  at identifying mistakes in code without caring about formatting. It finds 12
  issues in our code in 12 seconds.
- [flake8][] - This tool has been in development since 2010, and combines
  pycodestyle, pyflakes and the `mccabe` tool into one package. It also
  has a plugin system that can extend the ruleset. It identifies 277 issues in
  our code in 600 milliseconds.
- [isort][] - This tool has been in development since 2017, and reformats
  imports to enforce a sort order and import style. It detects 99 issues in
  our code in 750 milliseconds.
- [bandit][] - This tool scans code for security issues. It finds 1997 low
  severity and 8 medium severity issues in our code in 1.5 seconds.
- [ruff][] - This tool, launched by VC-backed [Astral][] in 2023 and written in
  Rust, is optimized for speed and automatic fixing. With the default rules,
  which implement some `flake8` rules, it identifies 26 issues in our code,
  9 fixable, in 35 milliseconds. It has optional rules that implement the
  checks of all the previous tools.

[pylint]: https://pylint.readthedocs.io
[ruff]: https://docs.astral.sh/ruff/
[Astral]: https://astral.sh/blog/announcing-astral-the-company-behind-ruff
[flake8]: https://flake8.pycqa.org/en/latest/index.html
[pycodestyle]: https://pycodestyle.pycqa.org/en/latest/
[pyflakes]: https://github.com/PyCQA/pyflakes
[isort]: https://pycqa.github.io/isort/index.html
[bandit]: https://github.com/PyCQA/bandit

`ruff` is a good choice to add missing coverage for Python. It fulfills
all six criteria, and excels at speed.

- **Good defaults** - It provides similar checks to `flake8` by default.
  The default configuration is compatible with `black` and Python 3.8.
  It uses the standard [pyproject.toml][] for configuration. It provides
  rulesets that emulate `pylint`, `pycodestyle`, `isort`, and `bandit`.
  It also provides rules for dozens of popular `flake8` plugins.
- **Mark False Positives** - `ruff` supports exception rules in the
  configuration file. It supports the comment `# ruff: noqa` to turn off
  errors in code. It also checks for instances where the comment is not
  needed.
- **Fixes Issues when Appropriate** - The `ruff check --fix` option will change
  code when possible.
- **Checks on Pull Request** - `ruff check` can check Python code in pull
  requests.
- **Checks in the Development Environment** - The tool can be used in
  pre-commit checks in fix mode. There are editor integrations several editors
  including VS Code.
- **Speed** - The tool is 10x to 100x faster than other tools, fast enough
  to run on each file save.

The largest negative for `ruff` is that Astral is a VC-supported company, and
the tool may undergo changes in the future for monetization. It may be useful
to run the other tools supported by [PyCQA][] in parallel and in continuous
integration. This would ensure a community-supported alternative is available,
and may expose a different set of issues.

[PyCQA]: https://github.com/PyCQA
