#!/usr/bin/env bash
# Smoke-test DashScope (same as curl in task). Requires DASHSCOPE_API_KEY.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
curl -sS -w "\nHTTP_CODE:%{http_code}\n" -X POST \
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" \
  -H "Authorization: Bearer ${DASHSCOPE_API_KEY:?set DASHSCOPE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @"$DIR/dashscope-test-body.json"
