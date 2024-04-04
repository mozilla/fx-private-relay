# Use Code Linters to Enforce Layout and Discover Issues

- Status: Informational
- Deciders: Luke Crouch
- Date: 2024-04-04

Technical Story: [MPP-79][]

[MPP-79]: https://mozilla-hub.atlassian.net/browse/MPP-79

## Context and Problem Statement

A linter is a static analysis tool that finds bugs, style issues, and
suspicious constructs. Some of the areas addressed by different linting tools
include:

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
  language allows several ways to express it. Some examples are import order,
  or if default values should be specified by the caller.
- **Spelling and Grammar Checking** - Checks prose and comments in a similar
  way to a word processor. Comments often use project-specific technical
  terms, making this a different task from checking English prose.

Most developers appreciate that linters make multi-developer projects easier.
The shared project standards can be checked and enforced by tools. Code
reviewers can focus on the logic of changes, rather than the form of the code.
A linter may identify an unexpected issue. A developer can read the linter
documentation to learn more about the issue. This is one way a developer can
improve their understanding of the project's languages.

On the other hand, developers are annoyed by changes to their working process,
especially when the benefits are unclear or they disagree with the trade-offs.
It becomes harder to add a tool as the lines of code and the number of team
members grow. The best time to incorporate linters is at the start of the
project. Relay did not, so adding these tools has been a slower, more
deliberate process.

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
hook. The linters are configured in [.lintstagedrc.js][]. They run against the
files changed in each commit. When a tool supports fixing issues, it can update
the files before committing. Otherwise, detected issues will halt the commit,
giving the developer a chance to fix them.

[husky]: https://typicode.github.io/husky/
[lint-staged]: https://github.com/lint-staged/lint-staged
[.lintstagedrc.js]: https://github.com/mozilla/fx-private-relay/blob/main/.lintstagedrc.js

### stylelint

[stylelint][] identifies mistakes and standardizes constructs in CSS. Relay
uses a plugin to also check [SCSS/Sass][sass], an extended syntax for CSS. It
was added in July 2021.

The configuration file is at [frontend/.stylelintrc.cjs][]. Relay uses the
[stylelint-config-recommended-scss][] ruleset, and extends it with custom
rules.

[sass]: https://sass-lang.com/documentation/syntax/
[stylelint-config-recommended-scss]: https://github.com/stylelint-scss/stylelint-config-recommended-scss
[frontend/.stylelintrc.cjs]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.stylelintrc.cjs
[stylelint]: https://stylelint.io/

### prettier

[prettier][] is a code formatter for several languages. Relay uses it to format
JavaScript, TypeScript, CSS, SCSS, and Markdown (in the frontend folder). It
was added (again?) in December 2021.

The (empty) configuration file is at [frontend/.prettierrc.json][]. Relay and
other projects use the `prettier` defaults, and many tools are compatible with
`prettier` by default or by configuration.

[prettier]: https://prettier.io/
[frontend/.prettierrc.json]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.prettierrc.json

### TypeScript

[TypeScript][] extends JavaScript with type information. This can be used for
static checking of code, including finding errors like unknown variables. It is
compiled to JavaScript in a build step, mostly by removing the type hints. Relay
added TypeScript in March 2022 with the refactor to React / next.js.

The configuration at [frontend/tsconfig.json][] has a few customizations, many
to work with next.js. Relay has enabled the strict mode, which turns on a
default set of rules. The types are checked during the frontend build and
with `next lint`.

[TypeScript]: https://www.typescriptlang.org/
[frontend/tsconfig.json]: https://github.com/mozilla/fx-private-relay/blame/main/frontend/tsconfig.json

### next lint / ESLint

Next.js [integrates with ESLint][nextjs-eslint]. It identifies mistakes and
standardizes constructs in JavaScript. It can fix some issues automatically.
Relay has used ESLint since at least October 2020, and continued using it with
the next.js refactor in March 2022.

Relay uses Next.js's base ESLint configuration. This includes the tuning needed
to make [ESLint][] formatting compatible with `prettier`. A stricter rule set
that checks against [Google's Web Vitals][web-vitals] is also available. Relay
has expanded [frontend/.eslintrc.js][] to support our non-standard
configuration (static HTML generation with a Django server rather than a
next.js server).

[ESLint]: https://eslint.org/docs/latest/
[nextjs-eslint]: https://nextjs.org/docs/pages/building-your-application/configuring/eslint
[web-vitals]: https://web.dev/articles/vitals
[frontend/.eslintrc.js]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.eslintrc.js

### black

[black][] is a formatting tool to enforce layout of Python code. It rewrites
files in place, and reports if any files were reformatted. Relay adopted it in
May 2022.

`black` uses [pyproject.toml][] for configuration. Relay uses the default
configuration, but may add the minimum expected Python version to allow
using more recent syntax.

[black]: https://black.readthedocs.io/en/stable/index.html
[pyproject.toml]: https://github.com/mozilla/fx-private-relay/blob/main/pyproject.toml

### mypy

[mypy][] is a static type checker for Python. Relay added mypy support in April
2022, using an optional checking configuration as appropriate for an
[existing codebase][mypy-legacy].

`mypy` uses [pyproject.toml][] for configuration. Relay ignores issues with
third party libraries that do not ship type hints. Relay disables strict rules
that require code changes. These changes are made incrementally as technical
debt projects.

[mypy]: https://mypy.readthedocs.io/en/stable/
[mypy-legacy]: https://mypy.readthedocs.io/en/stable/existing_code.html

## Adding A New Linter

Adding a new linter is not free. Each developer needs to add it to their workflow.
Continuous Integration needs to run the linter on each pull request. Linting
issues must be addressed before merging.

The decision to add a linter has two parts. First, is a linter needed? Second,
which linter should be added?

### Decision Drivers: Is a Linter Needed?

When deciding _if a linter is needed_, some criteria are:

- **Is the language used in production?** It is useful to find issues in this
  code before it is shipped to users.
- **What is the impact of issues detected by the linter?** The highest impact
  issues are user-facing bugs, and some tools address this directly. Often a
  linter's purpose is to make code more uniform, which has a measurable
  impact on the speed and effectiveness of code reviews. Reviewers can spend
  time understanding the logic of code changes without the distraction of
  parsing.

Here is the linter chart again, focusing on areas without linters:

|                        | CSS | JavaScript | Python | Markdown | Shell Scripts |
| :--------------------- | :-- | :--------- | :----- | :------- | :------------ |
| Enforce Layout         | yes | yes        | yes    | yes      | no            |
| Check Types            | yes | yes        | yes    | n/a      | no            |
| Identify Mistakes      | yes | yes        | **no** | no       | no            |
| Standardize Constructs | yes | yes        | **no** | no       | no            |
| Spelling and Grammar   | no  | no         | no     | no       | no            |

Relay does not need more linters around Markdown at this time. Our
documentation is developer-facing, not user-facing. Errors in these documents
can be fixed on first review, and as they are encountered. There are tools like
the [markdownlint demo][] that can be used as needed.

Relay does not need shell script linters at this time. These scripts are used
in CircleCI to automate build and test steps. Errors in these scripts appear as
broken builds, and are fixed as part of normal development. They do not have a
direct impact on our users. There are tools like [ShellCheck][] that can be
used as needed.

Relay does not need linters around spelling and grammar at this time.
User-facing strings are translated, and are reviewed closely. A good code
comment with a spelling error can still be understood by another developer. A
perfectly formed but misleading comment should be deleted. There are tools
like [PyEnchant][], [Hemmingway][], and word processors that can be used by
developers without being checked in continuous integration.

As highlighted, there is a gap in Python linters. There is no official linter
to identify mistakes and standardize constructs. Python is used in production
for the web and API server, as well as background tasks. Errors in this code
will impact users, and non-standard code can slow down code reviews. This gap
meets the criteria for adding a new linter to CI and development.

[markdownlint demo]: https://dlaa.me/markdownlint/
[ShellCheck]: https://www.shellcheck.net/
[PyEnchant]: https://pyenchant.github.io/pyenchant/#
[Hemingway]: https://hemingwayapp.com/

## Decision Drivers for Choosing Between Similar Linters

A linter that is required for Relay development must have these attributes:

- **Checks on pull request** - The tool needs to run in the continuous
  integration (CI) environments, so that no failing code is merged to main.
- **Runs in the development environment** - Developers need to be able to
  run the tool locally. At a minimum, a developer should be able to run the
  tool once per commit. The developer should be able to run the tool manually
  as well. A developer should have high confidence that the tool runs the
  same locally as in CI.
- **Marks false positives** - There should be few false positives, where the
  tool identifies a problem but the code is OK. When there is a false
  positive, it should be possible to ignore it and get a passing check.

When choosing between similar tools, these attributes can help guide the
decision:

- **Good defaults** - If a tool has good default settings, it is more likely
  that it will need less project-specific configuration. Developers can use
  tips and tricks from other projects using the tool.
- **Fixes issues when appropriate** - A tool that enforces layout is more
  useful when it can rewrite the source code to the correct layout. The
  alternative, only identifying layout issues, makes for a worse developer
  experience. In other cases, it is better to identify the issue and let the
  developer decide how to fix it.
- **Editor integration** - When a tool is incorporated in the developer's code
  editor, enforcing layout and fixing issues becomes a natural part of the
  code writing process.
- **Speed** - A faster tool will be run earlier in the development process. If
  a tool runs in a millisecond, it can be incorporated into the editor,
  similar to syntax highlighting. If a tool runs in 100 milliseconds, it can
  be run every time the file is saved. If a tool takes a minute to run,
  developers will avoid running it locally, and wait for CI to identify
  issues.

There are many tools that address identifying mistakes and standardizing
constructs in Python. Some linters that would fill this role:

- [pylint][] - This tool has been in development since 2003, and has
  hundreds of built-in checks, including layout enforcement and spelling
  checkers. It works across entire codebases instead of individual files. It
  identifies 2,800 issues in our code, in 25 seconds.
- [pycodestyle][] - This tool, formerly known as `pep8`, has been in
  development since 2006, and is focused on code formatting and some code
  constructs. It identifies 317 issues in our code in 1.5 seconds.
- [pyflakes][] - This tool has been in development since 2009, targeted
  at identifying mistakes in code without caring about formatting. It finds
  12 issues in our code in 12 seconds.
- [flake8][] - This tool has been in development since 2010, and combines
  `pycodestyle`, `pyflakes` and the `mccabe` tool into one package. It also
  has a plugin system that can extend the ruleset. It identifies 277 issues
  in our code in 600 milliseconds.
- [isort][] - This tool has been in development since 2017, and reformats
  imports to enforce a sort order and import style. It detects 99 issues in
  our code in 750 milliseconds. It can be used as a `flake8` plugin.
- [bandit][] - This tool scans code for security issues. It finds 1997 low
  severity and 8 medium severity issues in our code in 1.5 seconds. It can be
  run as a `flake8` plugin.
- [ruff][] - This tool, launched in 2023 and written in
  Rust, is optimized for speed and automatic fixing. With the default rules,
  which implement some `flake8` rules, it identifies 26 issues in our code, 9
  fixable, in 35 milliseconds. It has optional rules that implement the
  checks of all the previous tools.

All the tools have the required attributes. They can be run in CI and in
the development environment. They are configurable, and have a mechanism for
marking false positives.

Three approaches that stand out:

- `pylint` for identifying the most issues. The defaults will need to be
  tuned to remove false positives, such as warnings on `assert` in tests. It
  is slow enough to cause pain if used for local development.
- `flake8` with several plugins (`isort`, `bandit`, others). This is a
  good mix of speed and coverage. The tools and plugins are maintained by
  [PyCQA][] and integrate well together.
- `ruff` with additional checks enabled. This tool can perform many of the
  checks that the other tools check. It runs 10x - 100x faster than the
  other tools. It also is compatible with `black` formatting by default.
  The largest negative is that [Astral][], the company that develops
  `ruff`, is VC-backed, and the tool may add monetization in the future.

Due to the speed and flexibility, `ruff` is the recommended tool for the
next linter, covering the important linting gap for Python.

[Astral]: https://astral.sh/blog/announcing-astral-the-company-behind-ruff
[PyCQA]: https://github.com/PyCQA
[bandit]: https://github.com/PyCQA/bandit
[flake8]: https://flake8.pycqa.org/en/latest/index.html
[isort]: https://pycqa.github.io/isort/index.html
[pycodestyle]: https://pycodestyle.pycqa.org/en/latest/
[pyflakes]: https://github.com/PyCQA/pyflakes
[pylint]: https://pylint.readthedocs.io
[ruff]: https://docs.astral.sh/ruff/
