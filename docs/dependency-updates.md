When dependencies release new versions, we want to make sure they don't break
Relay when we upgrade. This document describes what to look for when an upgrade
comes in.

## Things to know

Typically, we receive update notifications from
[Dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts),
which periodically checks for new versions of dependencies, and then submits
pull requests to update them.

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

You can line up multiple Dependabot PRs for merging by adding the comment
`@dependabot merge`. Dependabot will then automatically keep the PR up-to-date
with changes in `main`, and merge it if the Checks continue to run successfully.
Alternatively, you can use the CLI tool [`pmac`](https://github.com/willkg/paul-mclendahand).

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

### `@next/bundle-analyzer`

We use this package to investigate if any of our dependencies take up an
inordinate amount of bytes in our payload. To verify that this still runs
successfully, run

    ANALYZE=true npm run build

in the `frontend` directory locally, after installing the updated dependency. It
should create an overview of the client bundle in
`/frontend/.next/analyze/client.html`, which should look similar to the same
output in the `main` branch.

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
