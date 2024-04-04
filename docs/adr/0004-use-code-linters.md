# Use Code Linters to Enforce Layout and Discover Issues

- Status: Proposed
- Deciders: Luke Crouch
- Date: 2024-04-04

Technical Story: [MPP-79][]

[MPP-79]: https://mozilla-hub.atlassian.net/browse/MPP-79

## Context and Problem Statement

A linter is a static analysis tool that aids development. Some of the areas
addressed by different linting tools include:

- **Enforce Layout**: A tool can check and even reformat code to fit a project
  style. This helps make code and code changes easier to read and comprehend.
  It helps new contributors to match the existing project style.
- **Check Types**: Dynamic languages are flexible about variable types.
  Valid code with incorrect types can result in bugs and runtime errors. A
  linter can check type hints for consistent usage. Code editors can use type
  hints for documentation and assisted code writing.
- **Identify Mistakes**: A tool can detect common mistakes. Examples are
  identifying unused variables, and using loose equality in JavaScript.
- **Standardize Constructs**: There are many ways to express the same logic in
  code. A linter can suggest or rewrite code to a standard form. One example is
  the order and placement of imports. Another is omitting optional defaults to
  a function call.
- **Spelling and Grammar Checking**: These tools have different priorities from
  similar tools for word processors. They expect technical and project-specific
  terms. They look for text in prose and code comments.

Most developers appreciate that linters make multi-developer projects easier.
Tools automatically check and enforce project standards. Code reviewers focus
on the logic of changes, rather than the form of the code. A linter can teach
developers about unexpected issues and improve their understanding of the
project's languages.

Also, developers dislike changes to their working process. The benefits may be
unclear. They may disagree that the benefits are worth the extra effort. These
objections are easiest to overcome at the start of a project. As a project
becomes bigger, it becomes harder to satisfy a new tool. Adding a new tool to
a mature project is a slow, deliberate process.

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
uses a plugin to also check [SCSS/Sass][sass], an extended syntax for CSS.
Relay added `stylelint` in July 2021.

The configuration file is at [frontend/.stylelintrc.cjs][]. Relay uses the
[stylelint-config-recommended-scss][] ruleset, and extends it with custom
rules.

[sass]: https://sass-lang.com/documentation/syntax/
[stylelint-config-recommended-scss]: https://github.com/stylelint-scss/stylelint-config-recommended-scss
[frontend/.stylelintrc.cjs]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.stylelintrc.cjs
[stylelint]: https://stylelint.io/

### prettier

[prettier][] is a code formatter for several languages. Relay uses it to format
JavaScript, TypeScript, CSS, SCSS, and Markdown. Relay added `prettier` (again?)
in December 2021.

The (empty) configuration file is at [frontend/.prettierrc.json][]. Relay and
other projects use the `prettier` defaults. Many tools are compatible with
`prettier` by default or by configuration.

[prettier]: https://prettier.io/
[frontend/.prettierrc.json]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.prettierrc.json

### TypeScript

[TypeScript][] extends JavaScript with type information. It converts to
JavaScript in a build step, mostly by removing the type hints. Relay added
TypeScript in March 2022 with the refactor to React / next.js.

The configuration at [frontend/tsconfig.json][] has a few customizations.
Many of the changes help TypeScript work with `next.js`. Relay has enabled
strict mode, which turns on a default set of rules. The types are checked
during the frontend build and with `next lint`.

[TypeScript]: https://www.typescriptlang.org/
[frontend/tsconfig.json]: https://github.com/mozilla/fx-private-relay/blame/main/frontend/tsconfig.json

### next lint / ESLint

Next.js [integrates with ESLint][nextjs-eslint]. It identifies mistakes and
standardizes constructs in JavaScript. It can fix some issues automatically.
Relay added ESLint in October 2020 or earlier. Relay continued using it with
the next.js refactor in March 2022.

Relay uses Next.js's base ESLint configuration. This includes the tuning needed
to make [ESLint][] formatting compatible with `prettier`. A stricter rule set
that checks against [Google's Web Vitals][web-vitals] is also available. Relay
uses Django rather than `next.js`. Relay expanded [frontend/.eslintrc.js][] to
support this non-standard configuration.

[ESLint]: https://eslint.org/docs/latest/
[nextjs-eslint]: https://nextjs.org/docs/pages/building-your-application/configuring/eslint
[web-vitals]: https://web.dev/articles/vitals
[frontend/.eslintrc.js]: https://github.com/mozilla/fx-private-relay/blob/main/frontend/.eslintrc.js

### mypy

[mypy][] is a static type checker for Python. Relay added mypy support in April 2022. Relay started with a recommended configuration for an
[existing codebase][mypy-existing].

`mypy` uses [pyproject.toml][] for configuration. Relay ignores issues with
third party libraries that do not ship type hints. We disable strict rules
that need code changes to pass. We ratchet up `mypy` strictness over time.

[mypy]: https://mypy.readthedocs.io/en/stable/
[mypy-existing]: https://mypy.readthedocs.io/en/stable/existing_code.html

### black

[black][] is a formatting tool to enforce layout of Python code. It rewrites
files in place. Relay adopted it in May 2022.

`black` uses [pyproject.toml][] for configuration. Relay uses the default
configuration. In the future, Relay can tune the supported Python versions.

[black]: https://black.readthedocs.io/en/stable/index.html
[pyproject.toml]: https://github.com/mozilla/fx-private-relay/blob/main/pyproject.toml

## Adding A New Linter

Adding a new linter is not free. Each developer needs to add it to their workflow.
Continuous Integration (CI) needs to run the linter on each pull request.
Developers must address linting issues before merging.

The decision to add a linter has two parts. First, is a linter needed? Second,
which linter?

### Decision Drivers: Is a Linter Needed?

When deciding _if a linter is needed_, some criteria are:

- **Is the language used in production?** Issues in production code can impact
  users. A few seconds per pull request is worth avoiding a production bug.
- **What is the impact of issues detected by the linter?** The highest impact
  is avoiding a user-facing bug. The next level of impact is improving the
  speed and effectiveness of code reviews. Tools can handle the mechanical
  review. Reviewers are free to spend their time and attention on the logic of
  the code changes.

Here is the linter chart again, focusing on areas without linters:

|                        | CSS | JavaScript | Python | Markdown | Shell Scripts |
| :--------------------- | :-- | :--------- | :----- | :------- | :------------ |
| Enforce Layout         | yes | yes        | yes    | yes      | no            |
| Check Types            | yes | yes        | yes    | n/a      | no            |
| Identify Mistakes      | yes | yes        | **no** | no       | no            |
| Standardize Constructs | yes | yes        | **no** | no       | no            |
| Spelling and Grammar   | no  | no         | no     | no       | no            |

Relay does not suffer from a lack of Markdown linters. Our documentation is
developer-facing, not user-facing. Reviewers find the most obvious errors. A
document with a few typos is still useful and easy to fix. Authors and
reviewers can use tools like the [markdownlint demo][] when needed.

Relay does not suffer from a lack of shell script linters. Relay uses shell
scripts in CircleCI for build and test steps. Errors in these scripts appear as
broken builds. Developers fix them to unblock the build. These build failures
do not have a direct impact on our users. Authors and reviewers can use tools
like [ShellCheck][] when needed.

Relay does not suffer from spelling and grammar errors. Many reviewers check
new user-facing strings, as they proceed from design to translation. Errors in
code comments and function names do not cause bugs. A developer understands a
good code comment with a spelling error. A developer should delete a misleading
comment with perfect English. Authors and reviewers can use tools like
[PyEnchant][], [Hemingway][], and word processors when needed.

As highlighted, there is a gap in Python linters. There is no official linter
to identify mistakes and standardize constructs. Python is used in production
for the web and API server, as well as background tasks. Errors in this code
will impact users, and non-standard code can slow down code reviews. Relay
should add a new tool to address this gap.

[markdownlint demo]: https://dlaa.me/markdownlint/
[ShellCheck]: https://www.shellcheck.net/
[PyEnchant]: https://pyenchant.github.io/pyenchant/#
[Hemingway]: https://hemingwayapp.com/

## Decision Drivers: Which Linter?

A required linter must have these attributes:

- **Checks on pull request**: The continuous integration process needs to run
  the tool. If the tool identifies an issue, the build should fail. This
  prevents merging failing code.
- **Runs in the development environment**: Fast tools should run as a pre-commit
  step. A developer can run the tool on their machine. When the tool accepts the
  code, it should also pass in CI.
- **Marks false positives**: It should be rare to identify good code as causing
  a problem. When there is a false positive, it should be possible to ignore it
  and get a passing check.

When choosing between similar tools, these attributes can help guide the
decision:

- **Good defaults**: A tool with good defaults needs less configuration.
  The tool works the same across projects.
- **Fixes issues when appropriate**: Developers love a "fix it" button. A
  tool that can fix problems correctly is better than a tool that only
  identifies them. A developer should fix issues that need human judgment.
- **Editor integration**: A developer's primary tool is the code editor. An
  integrated tool helps fix issues as part of the writing process. A
  non-integrated tool turns code linting into an extra chore.
- **Speed**: A fast tool gets used. A slow tool gets skipped. A tool that runs
  on each file save should take less than a second. A pre-commit hook should
  run in less than five seconds. Developers should feel they save time running
  a tool, rather than waiting to see if it fails in CI.

There are many tools that address identifying mistakes and standardizing
constructs in Python. Some linters that would fill this role:

- [pylint][]: This tool has been in development since 2003. It has
  hundreds of built-in checks, including layout enforcement and spelling
  checkers. It works across entire codebases instead of individual files. It
  identifies 2,800 issues in our code, in 25 seconds.
- [pycodestyle][]: This tool, formerly known as `pep8`, has been in
  development since 2006. It is focused on code formatting and some code
  constructs. It identifies 317 issues in our code in 1.5 seconds.
- [pyflakes][]: This tool has been in development since 2009. It identifies
  mistakes in code without caring about formatting. It finds 12 issues in our
  code in 12 seconds.
- [flake8][]: This tool has been in development since 2010. It combines
  `pycodestyle`, `pyflakes` and the `mccabe` tool into one package. It also
  has a plugin system that can extend the ruleset. It identifies 277 issues
  in our code in 600 milliseconds.
- [isort][]: This tool has been in development since 2017. It reformats
  imports to enforce an order and style. It detects 99 issues in our code in
  750 milliseconds. It can be used as a `flake8` plugin.
- [bandit][]: This tool scans code for security issues. It finds 1997 low
  severity and 8 medium severity issues in our code in 1.5 seconds. It can be
  run as a `flake8` plugin.
- [ruff][]: This tool, launched in 2023 and written in Rust, is designed for
  speed and automatic fixing. It identifies 26 issues in our code, 9 fixable,
  in 35 milliseconds. It has optional rules that implement the checks of all
  the previous tools.

All the tools have the required attributes. They run in CI and in the
development environment. They are configurable, and have a mechanism for
marking false positives.

Three approaches that stand out:

- `pylint` for identifying the most issues. There are many false positives, such
  as missing documentation and understanding pytest fixtures. Significant
  configuration will cut these false positives. It is slow enough to
  cause pain if used for local development.
- `flake8` with several plugins (`isort`, `bandit`, others). This provides a
  good mix of speed and coverage. [PyCQA][] maintains the tools and plugins,
  and they work well together.
- `ruff` with additional checks enabled. This tool can enforce many of the
  rules of the other tools in a single package. It runs 10x - 100x faster than
  the other tools. It is compatible with `black` formatting by default.
  The largest negative is that [Astral][] is VC-backed. The tool may add
  monetization in the future.

Due to the speed and flexibility, `ruff` is the recommended tool for the
next linter.

[Astral]: https://astral.sh/blog/announcing-astral-the-company-behind-ruff
[PyCQA]: https://github.com/PyCQA
[bandit]: https://github.com/PyCQA/bandit
[flake8]: https://flake8.pycqa.org/en/latest/index.html
[isort]: https://pycqa.github.io/isort/index.html
[pycodestyle]: https://pycodestyle.pycqa.org/en/latest/
[pyflakes]: https://github.com/PyCQA/pyflakes
[pylint]: https://pylint.readthedocs.io
[ruff]: https://docs.astral.sh/ruff/
