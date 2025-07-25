# How to update Firefox Remote Settings lists

Firefox only shows Relay on sites in the `fxrelay-allowlist` collection in Remote Settings.
We periodically review and test sites listed in the Relay Mask Acceptance spreadsheet to
verify that they accept Relay email masks, and we update the Remote Settings allowlist
based on the spreadsheet.

The Remote Settings team runs an automated script that updates the Remote Settings
collection whenever we update our `privaterelay/fxrelay-allowlist-domains.txt` file.

## Get the latest values from Relay Mask Acceptance spreadsheet

When we review and test sites, we add a new sheet and name it according to the date of
the review.

1. Copy the "Domain" column of values from the most recent sheet.

## Update the `fxrelay-allowlist-domains.txt` file

In this repo:

1. Create a new branch
2. Open the `privaterelay/fxrelay-allowlist-domains.txt` file
3. Paste the domain values

## Push your branch up to GitHub

We use the GitHub branch as the source url to update the `dev` and `stage` Remote
Settings collections before the automated script updates the `prod` collection.

## Clone the Updater Repository

```
git clone https://github.com/mozilla/remote-settings-fxrelay-allowlist-updater
cd remote-settings-fxrelay-allowlist-updater
```

## Set Up Python Environment

```
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run the Script

- `ALLOWLIST_INPUT_URL`: URL to the allowlist .txt file. When testing a new update, use the raw github allowlist url of your branch.
- `AUTHORIZATION`: Specify valid authorization credentials, available in the Relay vault.
- `ENVIRONMENT`: Which Remote Settings server to update: `"dev"`, `"stage"`

E.g.,

```
ALLOWLIST_INPUT_URL=https://raw.githubusercontent.com/mozilla/fx-private-relay/796b5f7be734e1d210283aab9815b94f61e12e10/privaterelay/fxrelay-allowlist-domains.txt \
AUTHORIZATION="{redacted}" \
ENVIRONMENT="dev" \
python script.py
```

## Review and approve the changes in Remote Settings

1. Visit the `fxrelay-allowlist` collection in admin interface of the server you updated.
   - `dev`: https://remote-settings-dev.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist
   - `stage`: https://remote-settings.allizom.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist/records
2. You should see "Updated: \_\_ minutes ago" and "By: account:fxrelay-publisher"
3. Click "Review Changes"
   - In most cases, there will be a roughly equal amount of additions and deletions.
4. If the changes look reasonable, click "Approve"

## Merge the pull request

The automated script updates the production Remote Settings collection based on the raw
github allowlist url of the `main` branch of the repo. So, when you merge the pull
request, the automated script will update production Remote Settings.

## Review and approve the production changes in Remote Settings

The automated script will submit the changes to production, but we still need to review
and approve them. Follow the same steps as above, but Visit the production interface:

- `prod`: https://remote-settings.mozilla.org/v1/admin/#/buckets/main-workspace/collections/fxrelay-allowlist/records
