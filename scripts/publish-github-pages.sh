#!/usr/bin/env bash
set -euo pipefail

# Publish Cake Flap as a separate GitHub Pages project site.
# Requirements:
#   export GITHUB_TOKEN=...   # token with repo permissions
# Optional:
#   export GH_OWNER=grigorysolomatov
#   export REPO_NAME=cake-flappy

OWNER="${GH_OWNER:-grigorysolomatov}"
REPO="${REPO_NAME:-cake-flappy}"
DESCRIPTION="Cake Flap: a tiny cake-themed Flappy Bird browser game"
API="https://api.github.com"
AUTH_HEADER="Authorization: Bearer ${GITHUB_TOKEN:-}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required; refusing to publish without authentication." >&2
  exit 2
fi

# Create repository if it does not exist.
status=$(curl -sS -o /tmp/cake-flappy-repo.json -w '%{http_code}' \
  -H "$AUTH_HEADER" \
  -H 'Accept: application/vnd.github+json' \
  "$API/repos/$OWNER/$REPO")

if [[ "$status" == "404" ]]; then
  echo "Creating GitHub repository $OWNER/$REPO ..."
  curl -fsS \
    -X POST \
    -H "$AUTH_HEADER" \
    -H 'Accept: application/vnd.github+json' \
    "$API/user/repos" \
    -d "{\"name\":\"$REPO\",\"description\":\"$DESCRIPTION\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}" >/tmp/cake-flappy-create.json
elif [[ "$status" == "200" ]]; then
  echo "Repository $OWNER/$REPO already exists; reusing it."
else
  echo "GitHub repo lookup failed with HTTP $status" >&2
  cat /tmp/cake-flappy-repo.json >&2
  exit 1
fi

# Push without embedding the token in the remote URL or storing credentials.
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO.git"
git -c http.extraHeader="$AUTH_HEADER" push -u origin main

# Enable GitHub Pages from main/root. If already enabled, update the source.
pages_status=$(curl -sS -o /tmp/cake-flappy-pages.json -w '%{http_code}' \
  -H "$AUTH_HEADER" \
  -H 'Accept: application/vnd.github+json' \
  "$API/repos/$OWNER/$REPO/pages")

if [[ "$pages_status" == "404" ]]; then
  echo "Enabling GitHub Pages ..."
  curl -fsS \
    -X POST \
    -H "$AUTH_HEADER" \
    -H 'Accept: application/vnd.github+json' \
    "$API/repos/$OWNER/$REPO/pages" \
    -d '{"source":{"branch":"main","path":"/"}}' >/tmp/cake-flappy-pages-enable.json
elif [[ "$pages_status" == "200" ]]; then
  echo "GitHub Pages already enabled; ensuring source is main/root ..."
  curl -fsS \
    -X PUT \
    -H "$AUTH_HEADER" \
    -H 'Accept: application/vnd.github+json' \
    "$API/repos/$OWNER/$REPO/pages" \
    -d '{"source":{"branch":"main","path":"/"}}' >/tmp/cake-flappy-pages-update.json || true
else
  echo "GitHub Pages lookup failed with HTTP $pages_status" >&2
  cat /tmp/cake-flappy-pages.json >&2
  exit 1
fi

echo "Published: https://$OWNER.github.io/$REPO/"
