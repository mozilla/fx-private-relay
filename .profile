#!/bin/bash
# Heroku-only file to copy env var credentials to gcp_key.json file
echo "${GOOGLE_CREDENTIALS_B64}" | base64 -d > gcp_key.json
