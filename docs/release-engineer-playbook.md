## Relay: Release Engineer playbook

1. Tuesday PM: [Release to stage][Release-to-stage] (tag, Github release notes)

   a. Ping all the engineers who have changes in the release to:

   - Move cards to “Ready to Test” if necessary
   - Include instructions for QA to test

   b. Confirm any hotfixes are also in the new tag

2. Wednesday-Monday

   a. Use the [Sentry Releases][sentry-releases] report to watch for any new issues

   b. Co-ordinate, re-tag for [stage fixes][stage-fixes] as needed

   - Allow ample time for QA testing which are done during European hours

> [!WARNING]
> Don't tag after Thursday, so QA has a stable stage environment to test before the Tuesday deployment to production.

3. Monday

   a. [Release Readiness Review][release-ready] (led by Easy)

   - Demo changes already in prod
   - Highlight changes in upcoming release
   - Designate next release engineer

   b. [Write SRE ticket, mention authors, reference in release notes][release-to-prod]

4. Tuesday

   a. SRE releases the tag to production

   b. Update Github Release to current release

   c. Monitor Sentry for production issues

   d. Hand-off Release Engineer duty to next engineer in rotation (GOTO 1.)

## Rotation

1. John
2. Lloan
3. Luke
4. Se Yeon
5. Rafee

[release-to-stage]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#release-to-stage
[sentry-releases]: https://mozilla.sentry.io/releases/
[stage-fixes]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#stage-fixes
[release-ready]: https://mozilla-hub.atlassian.net/wiki/spaces/SECPRV/pages/165675132/Sprint+Process#Release-Readiness-Review-(Relay)
[release-to-prod]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#release-to-prod
