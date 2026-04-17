#!/bin/bash
# Start the Popcorn API server with clean env.
# Claude Code injects ANTHROPIC_API_KEY="" into the shell, which overrides
# node's --env-file. This script unsets those vars first, then sources .env.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Clear shell-injected vars that would shadow .env values
unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL 2>/dev/null || true

# Load project .env
set -a
source "$REPO_ROOT/.env"
set +a

cd "$SCRIPT_DIR"
exec node --enable-source-maps ./dist/index.mjs
