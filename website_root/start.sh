#!/usr/bin/env bash
# Simple helper to run a local static server
set -euo pipefail
PORT=${1:-8000}
python3 -m http.server "$PORT" --directory "$(dirname "$0")"
