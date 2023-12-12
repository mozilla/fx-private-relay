When dependencies release new versions, we want to make sure they don't break
Relay when we upgrade. This document describes what to look for when an upgrade
comes in.

## Things to know

Typically, we receive update notifications from
[Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts),
which periodically checks for new versions of dependencies, and then submits
pull requests to update them. Project members can view the
[details of the latest dependency scans](https://github.com/mozilla/fx-private-relay/network/updates)
to troubleshoot issues.

Some terms to be aware of:

- **Checks**: at the bottom of a Pull Request's page, GitHub will list the
  outcomes of Continuous Integration runs. It calls these "checks".
- **CI results**: to view the results of a CI run (e.g. `test_frontend`), click
  the "Details" link next to the respective Check.
- **Preview deployment**: for
  every PR, a copy of the frontend with that PR's code is deployed to Netlify. You
  can view that deployment by clicking the "Details" link next to the
  `netlify/fx-relay-demo/deploy-preview` Check.

All dependency updates involve verifying that all Checks are successful,
investigating the results of failing CI runs, and a cursory inspection of the
changelog (if any) for anything that might be relevant to Relay, in particular
if a dependency's [major version](https://semver.org/) is bumped, or if a
dependency doesn't use Semantic Versioning.

If you're unsure whether anything looks as expected, try to replicate what
you're doing on the `main` branch. If the results differ, there's probably an
issue with the update.
**Make sure to do a fresh install of the dependencies when switching branches!**

You can line up multiple Dependabot PRs for merging by using the "Merge when ready"
button to add to the merge queue. The suggested comment `@dependabot merge`
does not work with the merge queue, and will not merge the PR.
Alternatively, you can use the CLI tool [`pmac`](https://github.com/willkg/paul-mclendahand)
to manually group updates into a single PR.

## npm

We have two npm projects in this repository: the website frontend (identified by
`/frontend/package.json`), and the root project from which our end-to-end tests
are run (identified by `/package.json`). The former is defined as a
[workspace](https://docs.npmjs.com/cli/v8/using-npm/workspaces) in the latter,
and both have their dependencies checked by Dependabot.

What follows is a list of dependencies and how to check for potential breakage when they release new versions:

### `*lint*`, `@types/*`, `typescript`, `*jest*`, `@testing-library/*`, `react-test-renderer`, `fast-check`, `prettier`

For linters, type definitions, and non-Playwright testing-related packages, a
successful CI run generally provides enough confidence that the upgrade is fine.
That said, it can't harm to occassionally scan the results of the
`build_frontend` or `test_frontend` CI runs to see if any new warnings were
added. If `jest-junit` is updated, you'll want to check that CircleCI can still
see code coverage for the frontend.

### `@playwright/test` and `dotenv`

Our Playwright tests are currently only triggered in CI once a day from the
`main` branch. Thus, there's unfortunately no easy way to verify that it still
runs successfully until after merging. To do so, after merging the PR, open the
"Actions" tab in GitHub, then find the "[Relay e2e
Tests](https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml)"
workflow on the left-hand side, and then use the "Run workflow" trigger button
in the top row of the table. Alternatively, you can also try run the end-to-end
tests locally by following the instructions in
[../e2e-tests/README.md](../e2e-tests/README.md#how-to-run).

`dotenv` is used to load environment variables for Playwright from `.env` files,
so can be verified in the same way.

### `react-aria` and `react-stately`

These dependencies handle most of the dynamic UI elements in our frontend, such
as the user menu and the app menu in the header, the modals when claiming a
subdomain or creating a new custom mask, or the toggle that allows you to set a
mask to block nothing, promotional emails, or everything. To verfy these
updates, open the preview deployments and check that you can still interact with
those using both a keyboard and a mouse.

### `@fluent/*`

[Fluent](https://projectfluent.org/) handles localisation, so verifying these
involves setting your browser language to something other than English, and
verifing that the website content indeed shows up in your chosen different
language.

### `next`

[Next.js](https://nextjs.org/) handles most of our frontend build pipeline and
bundling the website. To spot-check this update, open the Preview deployment to
verify that the website was put together successfully, and that you can navigate
between different pages (e.g. from the home to the FAQ) without issues.

### `swr` and `msw`

[SWR](https://swr.vercel.app/) is responsible for making requests to the
backend, whereas [MSW](https://mswjs.io/) intercepts API calls in the preview
deployment and returns mock data instead. Both can be verified by opening the
preview deployment and making sure that you can still interact with the API
(e.g. by creating a new mask).

### `sass` and `@mozilla-protocol/core`

[Sass](https://sass-lang.com/) gives us some handy tooling to ease working with
CSS, and [Protocol](https://protocol.mozilla.org/) is Mozilla's design system
from which we use some Sass variables. Both can be verified by checking the
preview deployment and making sure the styling doesn't look weird.

### `react` and `react-dom`

[React](https://react.dev/) is our front-end framework. If you can open the
preview deployment and general interactions still work, these upgrades were
probably successful.

### `react-toastify`

Handles the [toast](https://open-ui.org/components/toast.research/) notification
when e.g. saving settings, so if you can see that in the preview deployment,
it's still working as intended.

### `react-intersection-observer`

The most visible use of this is to make sure that the "Help & Tips" card in the
bottom right-hand corner of the Relay website sticks to the bottom of the
viewport, until the footer scrolls into view, in which case it should start
scrolling up. If you can still see that behaviour in the preview deployment,
it's probably fine.

### `react-ga`

Used to see how different parts of the website are being used via Google
Analytics. If you do not have [Do not
track](https://support.mozilla.org/en-US/kb/how-do-i-turn-do-not-track-feature)
enabled in your browser, then you should see pings we send to GA being logged in
the Console in the browser Dev Tools when browsing the preview deployment, e.g.

```
[react-ga] – "called ga('send', 'pageview', path);"
[react-ga] – "with path: /accounts/profile/?mockId=some"
```

### `cldr-localenames-modern`

Used for the list of countries in the "What country or region do you live in?"
dropdown at `/premium/waitlist`, so if you see that, it's all good.

### `husky` and `lint-staged`

Used to run basic code formatting when committing. You can verify that these
work locally by changing formatting (e.g. changing `"` into `'`) and checking
that it gets changed back (resulting in an empty commit) when committing.

### `chokidar-cli`

To watch files when running `npm run watch`. You can verify that this still
works by running that command and making sure that the server restarts if you
edit a source file.

## pip / Python

The Python requirements are in `/requirements.txt` at the project root. We
do not distinguish between development and production requirements for Python.
We recommend setting up and using a Python virtual environment, to keep Relay
packages distinct from other system packages - see the
[Development setup instructions](https://github.com/mozilla/fx-private-relay#development)
for details.
The command `python -m pip install -r requirements.txt` will install the packages.

In general, Python library developers write release notes, even if Dependabot has
trouble finding and linking to them. It is worth reading the release notes to
determine the changes from the previous version, and take note of suggested changes
to the Relay codebase.

Python developers often follow the
[Python version support schedule](https://www.python.org/downloads/), dropping support
for old Python versions even with few code changes. These are often released as minor
version updates, occasionally as major updates, but are generally safe updates
for Relay. The currently used Python version can be found in several places, such
as the
[Development setup instructions](https://github.com/mozilla/fx-private-relay#development).
Relay engineers attempt to update to new Python versions within 12
months of their release.

What follows is a list of dependencies and how to check for potential breakage
when they release new versions:

### black

For linters, see the details of the `black style check` test step for any breaking
syntax changes. If this test step passes, the upgrade is probably OK, and any warnings
can be handled in later PRs.

### pytest and plugins, coverage, model-bakery, responses

For testing tools, a successful CI test run means the upgrade is probably OK, and any
new warnings can be handled in later PRs.

### mypy and type stub libraries

For mypy and stub libraries, see the details of the `mypy type check` test step for any
breaking typing changes. If this test step passes, the upgrade is probably OK, and any
new warnings can be handled in later PRs.

### boto3

This is the interface library for Amazon Web Services (AWS). This library is
generated from the API definition files, and has multiple patch updates most
weeks. A successful CI test run means the upgrade is OK.

See the upgrade notes for a taste of the changes AWS developers are making to
the services we use. We use clients for the following services in code:

- S3 - Simple Storage Service
- SES - Simple Email Service
- SQS - Simple Queue Service

We use these additional AWS services in the Relay system:

- CloudFront - Content delivery network
- IAM - Identity and Access Management
- KMS - Key Management Service
- Route53 - Domain Name Service
- SNS - Simple Notification Service

### django

Relay currently uses a Long Term Support (LTS) release of Django. See the
[Django download page](https://www.djangoproject.com/download/) for version details.
Patch versions of the current version (such as 3.2.19 to 3.2.20) are often
security updates, and the release notes should be read to determine the impact
to Relay, as well as merged as soon as possible.

We try to update to the next LTS version within the year of release. This is often a
multi-week process, requiring updates to several resources, and tracked in a GitHub
issue and project task. Close dependency updates to the next LTS version if you
are not ready to update, to get them out of the PR queue.

We skip non-LTS versions (such as 5.0.0 and 5.1.0). Use the comment
`@dependabot ignore this minor version` to close the PR and avoid new updates for
that series.

### django-debug-toolbar

This package is development-only, and updates are generally safe to merge. To test,
update the package, start the server, and load `/emails/wrapped_email_test` locally.
The toolbar will be on the right side of the page, either expanded or minimized as
"DjDT" in the upper right corner.
