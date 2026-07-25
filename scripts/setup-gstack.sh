#!/usr/bin/env bash
# Installs gstack (https://github.com/garrytan/gstack) locally, scoped to
# this repo — NOT into ~/.claude/skills or any other global location.
#
# What this does:
#   1. Clones gstack into .gstack-src/ (gitignored — third-party source).
#   2. Runs its own ./setup with --local --no-team, which:
#        - builds the `browse` binary and links skills into .claude/skills/
#          of THIS repo only (no writes to ~/.claude).
#        - never touches this project's CLAUDE.md (--no-team skips the
#          team-init step, which is the only step that would).
#        - still writes minimal config/version state to ~/.gstack — gstack's
#          own design has no fully global-free mode; this is unavoidable but
#          is just a few small config/marker files, no code or binaries.
#   3. Points gstack at the sandbox's pre-installed Chromium instead of
#      downloading one, since this environment's proxy blocks the
#      playwright.dev download host. See the PLAYWRIGHT_BROWSERS_PATH block
#      below for how the local browser cache is assembled.
#
# Re-run anytime (idempotent) to refresh after a `git pull` of this script,
# or after gstack itself updates upstream.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d .gstack-src ]; then
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git .gstack-src
fi

# ── Local Chromium cache for playwright ──────────────────────────────────
# gstack pins a specific playwright-core revision. If that exact revision
# isn't already cached, playwright tries to download it — which fails here
# because the sandbox network policy blocks cdn.playwright.dev. Instead we
# expose the environment's pre-installed Chromium (at $PW_SYSTEM_BROWSERS,
# under whatever revision the base image ships) under the revision name
# gstack's playwright-core expects, entirely via symlinks (no download, no
# copy of the ~300MB binary).
PW_SYSTEM_BROWSERS="/opt/pw-browsers"
PW_LOCAL_BROWSERS="$(pwd)/.pw-browsers-local"
NEEDED_REV="$(grep -A3 '"name": "chromium"' .gstack-src/node_modules/playwright-core/browsers.json | grep -m1 '"revision"' | grep -o '[0-9]\+')"
NEEDED_HS_REV="$(grep -A3 '"name": "chromium-headless-shell"' .gstack-src/node_modules/playwright-core/browsers.json | grep -m1 '"revision"' | grep -o '[0-9]\+')"

if [ -d "$PW_SYSTEM_BROWSERS" ] && [ ! -e "$PW_LOCAL_BROWSERS/chromium-$NEEDED_REV/INSTALLATION_COMPLETE" ]; then
  SYS_REV_DIR="$(find "$PW_SYSTEM_BROWSERS" -maxdepth 1 -type d -name 'chromium-*' | head -1)"
  if [ -n "$SYS_REV_DIR" ]; then
    mkdir -p "$PW_LOCAL_BROWSERS/chromium-$NEEDED_REV"
    ln -snf "$SYS_REV_DIR/chrome-linux" "$PW_LOCAL_BROWSERS/chromium-$NEEDED_REV/chrome-linux"
    touch "$PW_LOCAL_BROWSERS/chromium-$NEEDED_REV/INSTALLATION_COMPLETE" \
          "$PW_LOCAL_BROWSERS/chromium-$NEEDED_REV/DEPENDENCIES_VALIDATED"
  fi
  SYS_HS_DIR="$(find "$PW_SYSTEM_BROWSERS" -maxdepth 1 -type d -name 'chromium_headless_shell-*' | head -1)"
  if [ -n "$SYS_HS_DIR" ]; then
    mkdir -p "$PW_LOCAL_BROWSERS/chromium_headless_shell-$NEEDED_HS_REV/chrome-headless-shell-linux64"
    for f in "$SYS_HS_DIR"/chrome-linux/*; do
      base="$(basename "$f")"
      [ "$base" = "headless_shell" ] && base="chrome-headless-shell"
      ln -snf "$f" "$PW_LOCAL_BROWSERS/chromium_headless_shell-$NEEDED_HS_REV/chrome-headless-shell-linux64/$base"
    done
    touch "$PW_LOCAL_BROWSERS/chromium_headless_shell-$NEEDED_HS_REV/INSTALLATION_COMPLETE" \
          "$PW_LOCAL_BROWSERS/chromium_headless_shell-$NEEDED_HS_REV/DEPENDENCIES_VALIDATED"
  fi
fi

# GSTACK_SKIP_FONTS / GSTACK_SKIP_COREUTILS: avoid any sudo/apt-get calls.
# --local --no-team --no-prefix: project-scoped skills dir, no CLAUDE.md
# edits, no global settings.json hooks, flat skill names (/qa, /ship, ...).
GSTACK_SKIP_FONTS=1 GSTACK_SKIP_COREUTILS=1 \
  PLAYWRIGHT_BROWSERS_PATH="$PW_LOCAL_BROWSERS" \
  bash .gstack-src/setup --local --no-team --host claude --no-prefix -q

echo ""
echo "gstack installed locally. Skills available under .claude/skills/ (e.g. /office-hours, /review, /ship)."
