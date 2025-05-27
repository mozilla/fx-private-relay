# Maintaining the FxRelay Allowlist Collection

This document describes how the Firefox Relay allowlist Remote Settings collection
(`fxrelay-allowlist`) is maintained and updated.

## Overview

The `fxrelay-allowlist` is a collection of domains managed via
[Mozilla Remote Settings][rs-docs]. Updates to the allowlist are automated using a
Django management command and a GitHub Actions workflow.

## Source of Truth

- The list of allowed domains is stored in a text file:  
  `privaterelay/fxrelay-allowlist-domains.txt`
- Each line in this file represents a domain to be included in the allowlist.

## Update Process

### 1. Trigger

- Any push to the `main` branch that modifies `privaterelay/fxrelay-allowlist-domains.txt`
  triggers the update workflow.

### 2. GitHub Actions Workflow

- The workflow is defined in `.github/workflows/update-allowlist.yml`.
- It performs the following steps:
  1. Checks out the repository.
  2. Sets up Python (version 3.11).
  3. Installs dependencies from `requirements.txt`.
  4. Runs the management command `update_fxrelay_allowlist_collection` with the necessary environment variables.

### 3. Management Command

- The command is implemented in `privaterelay/management/commands/update_fxrelay_allowlist_collection.py`.
- It performs the following actions:
  1. Downloads the latest allowlist from a configured URL (`ALLOWLIST_INPUT_URL`).
  2. Connects to the Remote Settings server using credentials and collection details provided via environment variables.
  3. Ensures the target bucket and collection exist.
  4. Compares the new allowlist with the existing records:
     - Removes domains no longer present or with mismatched IDs.
     - Adds new domains.
  5. If changes are made, requests a review for the updated collection.

#### Required Environment Variables

- `REMOTE_SETTINGS_SERVER`: URL of the Remote Settings server.
- `REMOTE_SETTINGS_AUTH`: Authentication credentials for the server.
- `REMOTE_SETTINGS_BUCKET`: Name of the bucket.
- `REMOTE_SETTINGS_COLLECTION`: Name of the collection.
- `ALLOWLIST_INPUT_URL`: URL to fetch the latest allowlist (typically points to the raw GitHub file).

These are provided as GitHub secrets in the workflow.

## Manual Execution

To run the update manually (with the correct environment variables set):

```sh
python manage.py update_fxrelay_allowlist_collection
```

## Review and Approval

- After changes are made, the collection status is set to `to-review` to request a review in Remote Settings.

---

**Summary:**  
The allowlist is maintained by editing a text file and pushing to `main`.
An automated workflow updates the Remote Settings collection accordingly,
ensuring the allowlist is always in sync with the repository.

[rs-docs]: https://remote-settings.readthedocs.io/en/latest/
