The frontend can be found in `/frontend`. It is a [Next.js](https://nextjs.org/) app, which means it uses [React](https://reactjs.org/).

# How does the frontend get built?

We're using Next.js's [static HTML export](https://nextjs.org/docs/advanced-features/static-html-export)
to generate a set of static HTML, JS and CSS files. Those are then served by our
Django backend [using Whitenoise](https://whitenoise.evans.io/en/stable/django.html#using-whitenoise-with-webpack-browserify-latest-js-thing).

# How do I navigate the frontend codebase?

Every URL (e.g. `relay.firefox.com/accounts/profile/`) has a corresponding `.page.tsx` file
(e.g. `/frontend/src/pages/accounts/profile.page.tsx`), so those are usually your entry points.

If your editor understands TypeScript, you can usually Ctrl+Click on a component to jump to
its definition, to narrow down to the relevant code.

Tip: install the
[React DevTools](https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Client-side_JavaScript_frameworks/React_resources#react_devtools)
to quickly find the relevant component.

# I want to...

## Add a new page

Create it in `/frontend/src/pages`. See https://nextjs.org/docs/basic-features/pages.

## Send a request to the API

We use [SWR](https://swr.vercel.app/). See `src/hooks/api` for examples.

## Add a new string

Add it to `pendingTranslations.ftl`, then submit a PR to the l10n repo.

## Add styling

We use [CSS modules](https://nextjs.org/docs/basic-features/built-in-css-support#adding-component-level-css).
Add a `.module.scss` or `.module.css` file for the component you're styling.
Class names in there will be modified to be unique; you can get those class
names as properties on the CSS file's default export.

Import tokens from [Protocol](https://protocol.mozilla.org).

## Add telemetry

Uses [`react-ga`](https://www.npmjs.com/package/react-ga).
`useGaPing` and `trackPurchaseStart`.

## Add a feature flag

In `/frontend/src/config.ts`, there's a Record type definition for the `featureFlags` property.
Add it to its key (e.g. `Record<"flag1" | "flag2", boolean>` lists two possible flags),
then set its value in `next.config.js`.

When the feature is rolled out to everyone, the flag can be removed by removing it from
the mentioned `Record`. TypeScript will then point out everywhere it is used.

## Fix a visual regression test

We use [Playwright](https://playwright.dev/) vor Visual Regression tests.
To ensure that they render consistently, the screenshots are generated in CI (GitHub Actions).
Hence, you'll need to push your new code to run the UI tests and generate new screenshots.
When creating a new Pull Request targeting `main`, the "Playwright Tests"
workflow will be triggered. If your changes affect what the page looks like,
they will fail. If you open the relevant workflow run (see
https://github.com/mozilla/fx-private-relay/actions), you should see that it
has produced a `playwright-report` artifact. Download and extract that, then open
the contained `index.html`. You will see an overview of the failed tests,
along with the "actual" vs "expected" screenshots. Ensure that the difference
is what you'd expect, then save the actual screenshot to
/frontend/ui-tests/visualRegression.spec.ts-snapshots/, overwriting the
relevant previous screenshot.

## Add a new visual regression test

To add a new Visual Regression test, take a look at
/frontend/ui-tests/visualRegression.spec.ts. After adding the code that
captures the element you want to snapshot, as above, push your change to GitHub
and wait for the Workflow to fail. Then, in the workflow's artifacts, download
the `screenshots` artifact. It should contain the desired snapshot; add it to
/frontend/ui-tests/visualRegression.spec.ts-snapshots/ and do another push.
Your test should now succeed.
