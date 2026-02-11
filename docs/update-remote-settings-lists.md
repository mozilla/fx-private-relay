# How to update Firefox Remote Settings lists (allowlist & blocklist)

Firefox decides whether to show Relay on a site using **two** Remote Settings collections in the `main-workspace` bucket:

- `fxrelay-allowlist` — domains where the Relay UI is eligible to appear for first-time users.
- `fxrelay-blocklist` — domains where the Relay UI must **not** appear (e.g., known breakage, abuse, or policy reasons). The blocklist takes precedence if a domain appears in both.

QA periodically performs [Relay Mask Acceptance Testing][testing] and updates the [Relay Mask Acceptance spreadsheet][spreadsheet] with their results.

Relay ENG updates the list files here in the `fx-private-relay` repo. This document describes this process.

The [remote-settings-fxrelay-allowlist-updater][updater] script syncs those files to the Remote Settings collections.

---

## Sources of truth

- The [Relay Mask Acceptance][spreadsheet] spreadsheet
- **Allowlist source file**: `privaterelay/fxrelay-allowlist-domains.txt`
- **Blocklist source file**: `privaterelay/fxrelay-blocklist-domains.txt`

> One domain per line. Use lower‑case; do not include URL schemes or paths.

---

## Update the list files

1. Create a new branch for the list updates
2. Open the [Relay Mask Acceptance][spreadsheet] spreadsheet
3. Select the tab with the most recent date
4. Filter the `QA Opinion` column to just the `Allow list` rows
5. Copy the `Domain` values of all rows
6. Open the `privaterelay/fxrelay-allowlist-domains.txt` file
7. Replace/paste the Domain values into the file
8. Sort the file to minimize the `diff`
9. For the `blocklist`, Repeat steps 4-8 filtering the `QA Opinion` column to `Deny list` and opening the `privaterelay/fxrelay-blocklist-domains.txt` file.
10. Open a PR as usual. We’ll use the **raw** URLs of your branch to test in `dev`/`stage` before merging.

---

## Sync to Remote Settings (dev)

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

### Run the script

Environment variables:

- `ALLOWLIST_INPUT_URL` — raw GitHub URL to the **allowlist** file (use your branch for testing).
- `BLOCKLIST_INPUT_URL` — raw GitHub URL to the **blocklist** file (use your branch for testing).
- `AUTHORIZATION` — valid credentials from the Relay vault.
- `ENVIRONMENT` — `"dev"` or `"stage"`

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
  1. Syncs `fxrelay-allowlist` (adds/removes records), automatically approves.
  2. Syncs `fxrelay-blocklist` (adds/removes records), automatically approves.

You’ll see counts of additions/deletions; if there are no diffs, no batch is submitted. You should receive an email notification of the update.

---

## Synct to Remote Settings (stage/prod)

If the changes look good on the dev server:

1. Merge the pull request to `main`.

The [updater script][updater] automatically syncs the stage & prod servers. When it does, you should receive an email with a link to approve the changes.

**What to check**

1. The collection shows a recent update `By: account:fxrelay-publisher`.
2. Click **Review Changes**.
3. Confirm the additions/deletions look right.
4. Click **Approve**.

Repeat for both collections.

---

## Operational tips & gotchas

- **Precedence**: If a domain appears in both lists, the **blocklist** wins (UI suppressed). Keep the lists mutually exclusive when possible to avoid confusion.
- **Formatting**: One domain per line; no wildcards, protocols, or paths. Use `example.com`, not `https://example.com/`.
- **Auth errors (401/403)**: Re‑check `AUTHORIZATION` from the Relay vault and your target `ENVIRONMENT`.
- **Connectivity**: The script logs a clear error if it cannot reach the server; nothing is applied in that case.
- **No changes**: If the computed sets are identical, the script skips batch operations and no review is requested.
- **Dry run**: The script supports a dry mode via its internals; if you need it, see the code for `IS_DRY_RUN`.

[testing]: https://docs.google.com/document/d/1YUQSr4pBgyF-Y872LuHYf_-0NmCpuP2ddUraO9Re44U/edit?tab=t.0#heading=h.a2fh3i7ae1rv
[spreadsheet]: https://docs.google.com/spreadsheets/d/1sq7UKjJFTsWcED1Jv0GODTtoOxHw0Q7uN7HwmtdBZxs/edit?gid=0#gid=0
[updater]: https://github.com/mozilla/remote-settings-fxrelay-allowlist-updater
