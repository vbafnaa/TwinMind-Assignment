#!/usr/bin/env sh
# Post-deploy smoke checks. Usage:
#   ./scripts/verify-deploy.sh https://your-api.example.com
set -e
BASE="${1%/}"
echo "GET $BASE/api/health"
curl -sS -f "$BASE/api/health" | cat
echo
echo "GET $BASE/api/defaults"
curl -sS -f "$BASE/api/defaults" | cat
echo
echo "OK"
