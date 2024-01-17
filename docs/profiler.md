# Profiler

This doc describes how we profile Relay code.

## Google Cloud Profiler

We use Google Cloud Profiler: https://cloud.google.com/profiler/docs/about-profiler

### Setup

Our google cloud profiler agent uses a service account with `roles/cloudprofiler.agent`
role. So, you need a JSON key file for the account, and you need to set the
`GOOGLE_APPLICATION_CREDENTIALS` environment variable to the fully qualified name of the
JSON key file.

#### Local servers

1. Get the JSON key file from another Relay ENGR
2. Update your `.env` `GOOGLE_APPLICATION_CREDENTIALS` value to the fully-qualified name
   of the JSON key file.

#### Dev server

For the dev server, we use a `.profile` (and/or `bin/pre_compile`) script which copies
the `GOOGLE_CREDENTIALS_B64` environment variable value into a `gcp_key.json` file at
build time.

#### Stage & Prod

TBD: Figure out if we should use Compute Engine, GKE, Flexible Environment, or Standard
Environment instructions from https://cloud.google.com/profiler/docs/profiling-python#using-profiler

### Viewing profiler data

Go to https://console.cloud.google.com/profiler/fxprivaterelay-nonprod/cpu?project=moz-fx-fxprivate-nonprod-6df0
