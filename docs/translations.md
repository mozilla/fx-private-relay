# Translation and Localization
Translations are maintained in separate repositories that are managed by the
[Mozilla Localization Team](https://github.com/mozilla-l10n). There is a
Pontoon project for the
[Relay Website](https://pontoon.mozilla.org/projects/firefox-relay-website/)
(which includes strings for the back-end email forwarding task)
and for the
[Add-on](https://pontoon.mozilla.org/projects/firefox-relay-add-on/). More
than 20 languages are supported.

The translation repositories are included as submodules, such as
`privaterelay/locales`. The submodule refers to a specific commit in the
separate repository. A GitHub action periodically updates this to the latest
commit, bringing in any new translations or other changes from the localization
team.

The translation bundles use the [Fluent format](https://projectfluent.org/).
They are included in the Docker image that is deployed to the stage and
production environments, and read by the email processing apps at runtime. They
are also embedded in the JavaScript during the build process, so that the
website text is translated.

The user's desired language is parsed from the `Accept-Language` header,
provided by their browser. When the user signs up for a Firefox Account, their
`Accept-Language` header is captured, and this is used for translated headers in
forwarded emails. When a user visits the Relay website or uses the add-on,
their current `Accept-Language` header is used.

There may not be an exact match between the desired language and those
supported by Firefox Relay. The website uses
[@fluent/langneg](https://github.com/projectfluent/fluent.js/tree/master/fluent-langneg)
to determine the best match. The email forwarding code uses custom Python. In
either case, if there is no best match, we fall back to English (`en`).

The email forwarding code logs an error when a translation is missing. These
logs (with log name `django_ftl.message_errors`) can be processed in BigQuery
to find issues with supported languages and to measure the popularity of
unsupported languages. There are no logs for missing translations in the
website front-end or the add-on.

See "Working with translations" in the project
[README.md](../README.md#working-with-translations) for instructions on working
with translations, such as adding new strings.
