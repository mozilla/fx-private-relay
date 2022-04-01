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

## Add/modify mock data

When you create a pull request, the frontend is deployed to Netlify using the code
from that PR. However, the back-end is mocked out (using [Mock Service Worker](https://mswjs.io/)).
You can also run the UI with a mocked back-end locally by running `npm run dev:mocked`
in the `frontend` directory.

The mock data is defined in `/frontend/src/apiMocks/mockData.ts`. For every API endpoint,
different sets of data are defined for different user IDs, defined in the
`mockIds` array. At the time of writing, the following mock users are available
(IDs are inspired by [the nine states of design](https://medium.com/swlh/the-nine-states-of-design-5bfe9b3d6d85)):

- `empty`: A user that just signed up for Relay, but has not created any aliases
           yet, nor have they upgraded to Premium.
- `onboarding`: A user that has just upgraded to Premium, but hasn't completed
                the Premium onboarding flow yet.
- `some`: A user that has an account that has seen some use: they've upgraded to
          Premium, and have created some aliases.
- `full`: A user that has utilised most of the features of Relay. They have
          Premium, set up a custom domain, have both random and custom aliases,
          and have experienced an email bounce.

If you append `?mockId=<mockId>` (e.g. `?mockId=some`) to the URL, it will
automatically log in as that mocked user. This is useful to quickly showcase a
feature that's only visible in a particular state to e.g. a non-engineer.
Alternatively, you can just click "Sign in", where you can choose between the
different mock users.

If you need to modify the mock data (e.g. because an API exposes some new data),
you can do so by first updating the API type definitions in the applicable API
endpoint's data fetching hook (in `/frontend/src/hooks/api/`). If you then look
at `mockData.ts` in an editor that supports TypeScript (or run
`npm run build:mocked`), you should then be guided through which objects need
updating.

If you want to add a new mock user, start by adding it to the `mockIds` array.
TypeScript will then show errors for every endpoint's mock data that has not yet
defined the relevant mock data, helping you add all the relevant data. Once
you've done that, you should then see the new mock user in the usual way.
