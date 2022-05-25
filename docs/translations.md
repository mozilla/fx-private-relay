# Translation and Localization
Translations are maintained in separate repositories that are managed by the
[Mozilla Localization Team](https://github.com/mozilla-l10n). There is a
Pontoon project for the
[Relay Website](https://pontoon.mozilla.org/projects/firefox-relay-website/)
and for the
[Add-on](https://pontoon.mozilla.org/projects/firefox-relay-add-on/). More
than 20 languages are supported.

The translation repositories are included as submodules, such as
`privaterelay/locales`. The submodule refers to a specific commit in the
separate repository. A GitHub action periodically updates this to the latest
commit, bringing in any new translations or other changes from the localization
team.

The translation bundles use the [Fluent format](https://projectfluent.org/).
They are also included in the Docker image, and read by the email processing
apps at runtime. They are also embedded in the JavaScript during the build
process, so that the website text is translated.

The user's desired language is stored with their Firefox Account, which uses
the `Accept-Language` header provided by the browser. If there is a matching
supported language, it is used for the website, add-on, and in email. If there
is no matching supported language, we fall back to English (`en`).

The application logs an error when a translation is missing. These logs (with
log name `django_ftl.message_errors`) can be processed in BigQuery to find
issues with supported languages and to measure the popularity of unsupported
languages.

See "Working with translations" in the project README.md for instructions on
working with translations, such as adding new strings.
