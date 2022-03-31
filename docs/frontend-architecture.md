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
See `useGaViewPing` and `trackPurchaseStart`.

## Add/modify environment-specific data

We only compile our front-end once, and then deploy the built code to
our different environments (stage, production). This is different from an
approach that you might be familiar with from other front-end projects,
in which the code is built for each environment separately.

The consequence of this is that we can't inline environment-specific variables
in our built code (i.e.
[like this](https://nextjs.org/docs/basic-features/environment-variables)).
And since the front-end code is executed in the user's browser, it can't access
the server environment like our back-end can.

But of course, the back-end _can_. So instead, what we do is as follows. The
back-end exposes an API endpoint, `runtime_data`, via which it exposes selected
environment variables to the outside world. You can extend this endpoint in
`/api/views.py`. The front-end, then, makes an API request to that endpoint
using the `useRuntimeData` hook; you can find this in
`/frontend/src/hooks/api/runtimeData.ts`.

## Add a feature flag

In `/frontend/src/config.ts`, there's a Record type definition for the `featureFlags` property.
Add it to its key (e.g. `Record<"flag1" | "flag2", boolean>` lists two possible flags),
then set its value in `next.config.js`.

When the feature is rolled out to everyone, the flag can be removed by removing it from
the mentioned `Record`. TypeScript will then point out everywhere it is used.
