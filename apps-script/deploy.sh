#!/bin/bash
# Publish this folder's Code.gs to the LIVE waitlist web app as a NEW VERSION of the EXISTING
# deployment, so the /exec URL the landing page posts to never changes (2026-10-17).
#
# One-time on a machine: `npm install @google/clasp` in ~/.local/clasp, then `clasp login`
# as admin@onyx-tech.ai (the account that owns the Sales Lead List sheet). The linked project
# is in .clasp.json next to this file; appsscript.json is the manifest clasp expects.
#
# Usage:  ./deploy.sh "what changed"
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.local/clasp/node_modules/.bin:$PATH"
DEPLOYMENT_ID=AKfycbwgQGqmlgWKAfAOpV0NFifGjs64wF0F7W4XVUyWarqC93PWPIbX6QVgu7yvdblnrboY
DESC="${1:-brain deploy $(date +%Y-%m-%d\ %H:%M)}"

clasp push --force
clasp deploy --deploymentId "$DEPLOYMENT_ID" --description "$DESC"
clasp list-deployments | grep "$DEPLOYMENT_ID"
echo "count check (the public GET the landing page uses):"
curl -sL "https://script.google.com/macros/s/$DEPLOYMENT_ID/exec"; echo
