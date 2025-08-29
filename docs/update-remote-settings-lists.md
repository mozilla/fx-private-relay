# How to update Firefox Remote Settings lists (allowlist & blocklist)

Firefox decides whether to show Relay on a site using **two** Remote Settings collections in the `main-workspace` bucket:

- `fxrelay-allowlist` — domains where the Relay UI is eligible to appear.
- `fxrelay-blocklist` — domains where the Relay UI must **not** appear (e.g., known breakage, abuse, or policy reasons). The blocklist takes precedence if a domain appears in both.

We periodically review sites and update both lists from source files in the `fx-private-relay` repo. An updater script syncs those files to Remote Settings collections.

---

## Sources of truth

- **Allowlist source file**: `privaterelay/fxrelay-allowlist-domains.txt`
- **Blocklist source file**: `privaterelay/fxrelay-blocklist-domains.txt`

> One domain per line. Use lower‑case; do not include URL schemes or paths.

### Getting inputs from reviews

When we review and test sites (e.g., using the “Relay Mask Acceptance” spreadsheet and any notes/issues for problem domains):

1. **Allowlist**: copy the **Domain** column from the most recent review sheet into `fxrelay-allowlist-domains.txt`.
2. **Blocklist**: add any domains we explicitly want to **suppress** (reject Relay UI) to `fxrelay-blocklist-domains.txt`. These typically come from rejection testing, breakage reports, or policy decisions.

> If a separate “rejections/breakage” sheet or issue tracker exists, use that to populate the blocklist file.

---

## Update the list files

In the `fx-private-relay` repo:

1. Create a new branch.
2. Edit the two files:
   - `privaterelay/fxrelay-allowlist-domains.txt`
   - `privaterelay/fxrelay-blocklist-domains.txt`
3. Paste/update the domain values.
4. Commit and push your branch.

Open a PR as usual. We’ll use the **raw** URLs of your branch to test in `dev`/`stage` before merging.

---

## Sync to Remote Settings (dev/stage)

Clone the updater:

```bash
git clone https://github.com/mozilla/remote-settings-fxrelay-allowlist-updater
cd remote-settings-fxrelay-allowlist-updater
```

Set up Python:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Run the script (now syncs both lists)

Environment variables:

- `ALLOWLIST_INPUT_URL` — raw GitHub URL to the **allowlist** file (use your branch for testing).
- `BLOCKLIST_INPUT_URL` — raw GitHub URL to the **blocklist** file (use your branch for testing).
- `AUTHORIZATION` — valid credentials from the Relay vault.
- `ENVIRONMENT` — which Remote Settings server to update: `"dev"` or `"stage"` for pre‑prod verification. (Production is updated automatically on merge; see below.)

Example:

```bash
ALLOWLIST_INPUT_URL="https://raw.githubusercontent.com/mozilla/fx-private-relay/<your-branch>/privaterelay/fxrelay-allowlist-domains.txt" \
BLOCKLIST_INPUT_URL="https://raw.githubusercontent.com/mozilla/fx-private-relay/<your-branch>/privaterelay/fxrelay-blocklist-domains.txt" \
AUTHORIZATION="{redacted}" \
ENVIRONMENT="dev" \
python script.py
```

**What happens:**

- The script loads both list files, then:
  1. Syncs `fxrelay-allowlist` (adds/removes records), requests review.
  2. Syncs `fxrelay-blocklist` (adds/removes records), requests review.

You’ll see counts of additions/deletions; if there are no diffs, no batch is submitted.

---

## Review & approve in Remote Settings

Open the admin UI for the server you updated and review **both** collections.

### Dev

- Allowlist: https://remote-settings-dev.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist/records
- Blocklist: https://remote-settings-dev.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-blocklist/records

### Stage

- Allowlist: https://remote-settings.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist/records
- Blocklist: https://remote-settings.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-blocklist/records

**What to check**

1. The collection shows a recent update and `By: account:fxrelay-publisher`.
2. Click **Review Changes**.
3. Confirm the additions/deletions look reasonable (often roughly balanced after a refresh).
4. Click **Approve**.

Repeat for both collections.

---

## Merge the PR (production updates)

Production Remote Settings is updated by automation that reads the **raw files on `main`**:

- `privaterelay/fxrelay-allowlist-domains.txt`
- `privaterelay/fxrelay-blocklist-domains.txt`

Once you merge to `main`, the automation submits changes to **both** `fxrelay-allowlist` and `fxrelay-blocklist` in production.

---

## Review & approve in production

After the automation runs, review and approve the production changes just like dev/stage:

- Allowlist: https://remote-settings.mozilla.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist/records
- Blocklist: https://remote-settings.mozilla.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-blocklist/records

---

## Operational tips & gotchas

- **Precedence**: If a domain appears in both lists, the **blocklist** wins (UI suppressed). Keep the lists mutually exclusive when possible to avoid confusion.
- **Formatting**: One domain per line; no wildcards, protocols, or paths. Use `example.com`, not `https://example.com/`.
- **Auth errors (401/403)**: Re‑check `AUTHORIZATION` from the Relay vault and your target `ENVIRONMENT`.
- **Connectivity**: The script logs a clear error if it cannot reach the server; nothing is applied in that case.
- **No changes**: If the computed sets are identical, the script skips batch operations and no review is requested.
- **Dry run**: The script supports a dry mode via its internals; if you need it, see the code for `IS_DRY_RUN`.

---

## Quick checklist

1. Update both files in `fx-private-relay` (`allowlist` & `blocklist`).
2. Push a branch + open PR.
3. Run the updater against `dev` (and then `stage`) using your branch’s raw URLs.
4. Review & approve **both** collections in the admin UI.
5. Merge the PR to `main`.
6. Review & approve **both** collections in **prod** once automation submits them.
