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

   a. [Release Readiness Review][release-ready]

   - Demo changes already in prod
   - Highlight changes in upcoming release
   - Designate next release engineer

   b. [Write SRE ticket, mention authors, reference in release notes][release-to-prod]

4. Tuesday

5. SRE releases the tag to production
6. Run [the e2e tests GitHub action][github-action-e2e-tests]
   - Branch: select the release tag
   - Environment: prod
7. Update the [Github Release][github-release] to current release
8. Monitor the [Sentry Releases Page][sentry-releases] for new issues in the release
9. Monitor the [Grafana Operations Dashboard][grafana-dashboard] for anomolies,
   especially:
   - [HTTP Requests][grafana-http-requests]
   - [HTTP Latencies][grafana-http-latencies]
   - [Postgres CPU][grafana-postgres-cpu]
   - [SES Operations][grafana-ses-operations]
   - [Undelivered email][grafana-undelivered-email]
   - [SES Email sending time][grafana-ses-email-sending-time]
   - TBD: Phone activity
10. Hand-off Release Engineer duty to next engineer in rotation (GOTO 1.)

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
[github-action-e2e-tests]: https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml
[github-release]: https://github.com/mozilla/fx-private-relay/releases
[grafana-dashboard]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m
[grafana-http-requests]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=12
[grafana-http-latencies]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=83
[grafana-postgres-cpu]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=15
[grafana-ses-operations]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=54
[grafana-undelivered-email]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=65
[grafana-ses-email-sending-time]: https://earthangel-b40313e5.influxcloud.net/d/qiwPC76Zk/fx-private-relay?orgId=1&refresh=1m&viewPanel=131
