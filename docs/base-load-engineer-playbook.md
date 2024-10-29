# Relay: "Base load" Engineer playbook

Starting in H2'24, Relay ENGR team expanded the "Release Engineer" role into a "Base
load Engineer" role who handles consistent expected work like releases and dependency
updates, and who fields un-planned incoming work requests like bug reports and customer
support requests. (The term "[base load][]" comes from electrical grids, where it
describes the minimum level of demand over a span of time.)

[base load]: https://en.wikipedia.org/wiki/Base_load

## Rotation

Relay ENGRs rotate thru the "Base load" role every 2 weeks on Tuesdays, to coincide with
our weekly Tuesday release schedule. The current Relay ENGR team consists of these
engineers who rotate thru the role:

1. [@jwhitlock](https://github.com/jwhitlock)
2. [@groovecoder](https://github.com/groovecoder)

## Daily routine

Your primary role is to perform the checks and make sure the necessary work gets done.
You don't have to perform every task yourself. When you check any of the channels below,
you may delegate the resulting task to the most appropriate party.

If any items found during the checks below are [incident-level severity][], you are
likely to take the role of engineering lead for the incident unless you delegate to
another more appropriate party.

1. Check [Security Dependabot Alerts][security-dependabot-alerts] for any critical
   security updates to make
2. Check #relay-alerts for any critical operational issues to fix
3. Check the [Sentry Releases][sentry-releases] report to watch for any new issues
4. Check #relay-jira-triage for any urgent new tickets
5. Check #privsec-customer-experience channel for any urgent inbound CX requests
6. Check [dependabot pull requests][dependabot-prs].
   - See the [Dependency Updates doc][dependency-updates-doc].
7. Co-ordinate, re-tag for [stage fixes][stage-fixes] as needed

[incident-level severity]: https://mozilla-hub.atlassian.net/wiki/spaces/MIR/pages/20512894/Incident+Severity+Levels

## Mondays

1. Daily routine
2. Prepare release for tomorrow
   - Look thru [What's Deployed][whats-deployed] tool to make sure all the
     commits on stage are ready to go to prod.
   - You can also run a [comparison on GitHub][github-compare] between [the stage
     version][stage-version] and [the prod version][prod-version].
   - [Write SRE ticket, mention authors, reference in release notes][release-to-prod]

## Tuesdays

1. Daily routine
2. SRE processes ticket to release the tag to production
3. Update [Github Release][github-releases] to current release
4. Monitor [Sentry Releases][sentry-releases] for new production issues
5. (On your 3rd Tuesday) Hand-off base load duties to next engineer in rotation

## Wednesdays

1. Daily routine
2. Before releasing to Stage, [run e2e tests][run-e2e-tests] against the dev environment via GitHub Actions.
   - Ensure that the e2e tests are passing.
   - If e2e Playwright tests are flaky--fails to pass for reasons outside of legitimate Relay bug--consider making the tests more reliable by using the [locators][playwright-locators], [auto-retrying assertions][playwright-auto-retrying-assertions], or [fixtures][playwright-fixtures]. For more suggestions on making Playwright tests more reliable or efficient, see [documentation on FxA test improvements][fxa-test-improvements].
3. [Release to stage][Release-to-stage] (tag, Github release notes)
   - Ping all the engineers who have changes in the release to:
     - Move cards to “Ready to Test” if necessary
     - Include instructions for QA to test
   - Confirm any hotfixes are also in the new tag

## Thursday and Fridays

1. Daily routine

[security-dependabot-alerts]: https://github.com/mozilla/fx-private-relay/security/dependabot
[whats-deployed]: https://whatsdeployed.io/s/60j/mozilla/fx-private-relay
[github-compare]: https://github.com/mozilla/fx-private-relay/compare/
[stage-version]: https://stage.fxprivaterelay.nonprod.cloudops.mozgcp.net/__version__
[prod-version]: https://relay.firefox.com/__version__
[github-releases]: https://github.com/mozilla/fx-private-relay/releases
[run-e2e-tests]: https://github.com/mozilla/fx-private-relay/actions/workflows/playwright.yml
[playwright-locators]: https://playwright.dev/docs/locators
[playwright-auto-retrying-assertions]: https://playwright.dev/docs/test-assertions#auto-retrying-assertions
[playwright-fixtures]: https://playwright.dev/docs/test-fixtures
[fxa-test-improvements]: https://docs.google.com/presentation/d/1dSASq9xcaA8DuQM_1_Ab6q5_ScBpvqI9NPHvovkA-wU/edit#slide=id.g276e3207c4d_1_427
[release-to-stage]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#release-to-stage
[sentry-releases]: https://mozilla.sentry.io/releases/
[stage-fixes]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#stage-fixes
[release-to-prod]: https://github.com/mozilla/fx-private-relay/blob/main/docs/release_process.md#release-to-prod
[dependabot-prs]: https://github.com/mozilla/fx-private-relay/pulls/app%2Fdependabot
[dependency-updates-doc]: https://github.com/mozilla/fx-private-relay/blob/main/docs/dependency-updates.md
