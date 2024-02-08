# Profiler

This doc describes how we profile Relay code.

## Google Cloud Profiler

We use Google Cloud Profiler: https://cloud.google.com/profiler/docs/about-profiler

### Setup

These are the high-level steps to set up Google Cloud Profiler in Relay.

1. Enable the Profiler API in the Google Cloud console for the project.
2. Create a service account with `roles/cloudprofiler.agent` role.
3. Download the JSON key file for the account
4. Base64-encode the contents of the JSON key file
5. Set `GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64` environment variable to the Base64-encoded contents of
   the JSON key file

#### Local servers

1. Get the Base64-encoded JSON key from another Relay ENGR
2. Update your `GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64` environment variable value to the
   Base64-encoded JSON key
3. Add `"local"` to the `settings.RELAY_CHANNEL` checks in `privaterelay/apps.py`

#### Dev server

The dev server should already have profiling set up. If it does not:

1. Get the Base64-encoded JSON key from another Relay ENGR
2. Use `heroku config:set` to set the `GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64`
   environment variable value to the Base64-encoded JSON key.
3. Use `heroku config:set` to set the `GOOGLE_APPLICATION_CREDENTIALS`
   environment variable value to `gcp_key.json`

#### Stage & Prod

The stage & prod servers should already have profiling set up. If they do not:

1. Have SRE set the `GOOGLE_CLOUD_PROFILER_CREDENTIALS_B64` environment variable value
   to the corresponding Base64-encoded JSON key with `roles/cloudprofiler.agent`
   permission to the project.

### Viewing profiler data

Go to https://console.cloud.google.com/profiler/fxprivaterelay-nonprod/cpu?project=moz-fx-fxprivate-nonprod-6df0
