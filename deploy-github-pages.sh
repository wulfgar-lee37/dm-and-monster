#!/bin/bash
set -euo pipefail

REPO_NAME="dm-and-monster"
GH="${GH:-gh}"

if ! command -v "$GH" >/dev/null 2>&1; then
  echo "GitHub CLI (gh) not found. Install from https://cli.github.com or: brew install gh"
  exit 1
fi

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Log in to GitHub (one-time):"
  "$GH" auth login --hostname github.com --git-protocol https --web
fi

cd "$(dirname "$0")"

if git remote get-url origin >/dev/null 2>&1; then
  echo "Pushing to existing origin..."
  git push -u origin main
else
  echo "Creating GitHub repo and pushing..."
  "$GH" repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

OWNER=$("$GH" api user --jq .login)
echo "Enabling GitHub Pages..."
"$GH" api "repos/${OWNER}/${REPO_NAME}/pages" -X POST -f build_type=workflow >/dev/null 2>&1 || true

echo ""
echo "Done! Site will be live in 1-2 minutes at:"
echo "https://${OWNER}.github.io/${REPO_NAME}/"
echo ""
echo "Check deploy status: https://github.com/${OWNER}/${REPO_NAME}/actions"
