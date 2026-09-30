#!/bin/bash
set -euo pipefail

REPO_NAME="dm-and-monster"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GH_DIR="$SCRIPT_DIR/.tools/gh"
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then GH_ARCH="arm64"; else GH_ARCH="amd64"; fi
GH="$GH_DIR/bin/gh"

install_gh() {
  echo "Installing GitHub CLI (no Homebrew needed)..."
  mkdir -p "$GH_DIR"
  TMPZIP=$(mktemp /tmp/gh.XXXXXX.zip)
  curl -fsSL "https://github.com/cli/cli/releases/download/v2.67.0/gh_2.67.0_macOS_${GH_ARCH}.zip" -o "$TMPZIP"
  unzip -qo "$TMPZIP" -d "$GH_DIR"
  rm "$TMPZIP"
  mv "$GH_DIR"/gh_*/* "$GH_DIR/"
  rmdir "$GH_DIR"/gh_* 2>/dev/null || true
  echo "GitHub CLI installed."
}

if [ ! -x "$GH" ]; then
  if command -v gh >/dev/null 2>&1; then
    GH=$(command -v gh)
  else
    install_gh
  fi
fi

if ! "$GH" auth status >/dev/null 2>&1; then
  echo ""
  echo "Log in to GitHub (one-time, opens browser):"
  "$GH" auth login --hostname github.com --git-protocol https --web
fi

cd "$SCRIPT_DIR"

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
