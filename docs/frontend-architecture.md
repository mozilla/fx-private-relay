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

Add it to `pendingTranslations.ftl`, then submit a PR to the l10n repo. Updates
to that repository (both yours, as well as updated translations from Pontoon)
are automatically pushed to this repository (see the "Update submodules" commits
in the commit history) by
[a scheduled daily job](https://github.com/mozilla-l10n/fx-private-relay-l10n/actions/workflows/update-upstream-relay-repo.yml).

## Add styling

We use [CSS modules](https://nextjs.org/docs/basic-features/built-in-css-support#adding-component-level-css).
Add a `.module.scss` or `.module.css` file for the component you're styling.
Class names in there will be modified to be unique; you can get those class
names as properties on the CSS file's default export.

Import tokens from [Protocol](https://protocol.mozilla.org).

## Add telemetry

Uses [`react-ga`](https://www.npmjs.com/package/react-ga).
See `useGaViewPing` (and `useFxaFlowTracker` when measuring use of sign in/up
links in particular) and `trackPurchaseStart`.

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

## Communicate with the add-on

There are two types of communication between the add-on and the website:
sharing data, and notifications of events. And since this communication can
happen in either direction, there are four situations to consider:

### 1. The website shares data with the add-on

This is mainly to tell the add-on which user is currently logged in, and data
about them. (There are also plans to minimise this to only share the API key
with the add-on, which can then fetch the rest of the data from the API
directly, and even to have the add-on authenticate against Mozilla Accounts
directly and then being able to communicate with the API without even needing to
interact with the website.)

This is done via the `<firefox-private-relay-addon-data>` element, present in
the user's dashboard, rendered by the `<AddonData>` component. The add-on
looks for that element via its ID (`#profile-main`) and reads its attributes.

Thus, if you want to share data with the add-on, you can add it as an attribute
there. Then in the add-on, you can expand
[`get_profile_data.js`](https://github.com/mozilla/fx-private-relay-add-on/blob/main/src/js/relay.firefox.com/get_profile_data.js)
to read it and copy it over to the extension storage.

### 2. The add-on shares data with the website

The add-on mainly tells the website whether it is installed, and, in case the
user has disabled server-side storage of mask labels, the labels it has stored
locally. It does so by changing attributes on the
`<firefox-private-relay-addon>` element, rendered in
[`_app.page.tsx`](../frontend/src/pages/_app.page.tsx).
React components looking to access that data can do so using the `useAddonData`
hook.

If you have more data to share with the website, you can add it in the add-on
in `inject_addon_data.js`. To then make it available in the website, add the
data you're injecting to the `AddonData` type in
[`/frontend/src/hooks/addon.ts`](../frontend/src/hooks/addon.ts).
Additionally, since attributes are always strings, you'll want to define how to
convert that to the proper data structure (e.g. via `JSON.parse`) by adding a
property to the `attributeParsers` object in that same file. The property name
is the attribute you're writing, and the value is a function that takes a string
(the attribute value) and returns the proper data structure.

### 3. The website sends a notification to the add-on

When e.g. the user performs an action on the website that the add-on should
immediately act on, the website can send it a notification. This is used e.g. to
tell the add-on to update the extension's storage when the user changes a mask
label and has server-side storage disabled.

To do so, React components can again use the `useAddonData` hook, whose return
value also includes a `sendEvent` function. This then fires a `website` event on
the `<firefox-private-relay-addon>` element, which is listened to by the add-on
in
[`get_profile_data.js`](https://github.com/mozilla/fx-private-relay-add-on/blob/main/src/js/relay.firefox.com/get_profile_data.js).

### 4. The add-on sends a notification to the website

We don't actually do this. Instead, the add-on simply calls
`browser.tabs.reload` on any open website tab if it needs to reflect updated
data.

## Show/hide content to/from users with the add-on installed

Apply the class `is-visible-with-addon` to hide an element unless the user is
visiting with the add-on. Conversely, add `is-hidden-with-addon` to _show_ it
unless the user is visiting with the add-on. Note that these are plain CSS
classes, i.e. not CSS modules (in other words, use them as plain strings, rather
than via `styles["is-visible-with-addon"]`).

They are defined in `/frontend/src/styles/globals.scss` for the website, and in
`relay-website.css` in the add-on.

## Work on the tracker removal report

Forwarded emails with blocked trackers contain a link to a report listing the
detected trackers. This report is located at `/tracker-report/`, and hence
generated by `/frontend/src/pages/tracker-report.page.tsx`. The content of the
report is generated dynamically, based on data passed to it via the _fragment_
(also known as _hash_, i.e. the part after `#`) in the URL. This ensures that
the server does not have to do extra work to generate that report, and since
browsers do not even send fragments to the server, the data contained in the
report won't show up in our logs either.

In essence, the data is a URL encoded JSON object with three fields:

- `sender`: a string, containing the email address that sent the email in which
  trackers were blocked.
- `received_at`: a number, containing the UNIX time (i.e. nr. of seconds since
  Jan 1st, midnight, UTC, so the output of `Date.now()`) the email was sent.
- `trackers`: an object with the tracker domains as keys, and the number found
  trackers from that domain as a value.

An example:

    {
      "sender": "email@example.com",
      "received_at": 1655288077484,
      "trackers": {
        "ads.facebook.com": 1,
        "ads.googletagmanager.com": 2
      }
    }

You can generate this URL yourself by pasing the following in your browser
console, changing the contents of `JSON.stringify()` with your desired values:

    { let url = new URL("http://localhost:3000/tracker-report"); url.hash = JSON.stringify({ sender: "email@example.com", received_at: Date.now(), trackers: { "ads.facebook.com": 1, "ads.googletagmanager.com": 2 } }); url.href }

This generates the following URL:

    http://localhost:3000/tracker-report#{%22sender%22:%22email@example.com%22,%22received_at%22:1655288077484,%22trackers%22:{%22ads.facebook.com%22:1,%22ads.googletagmanager.com%22:2}}
