# Smoke-test DashScope OpenAI-compatible chat completions (Singapore intl endpoint).
# Requires: $env:DASHSCOPE_API_KEY (or pass -ApiKey).
param(
  [string] $ApiKey = $env:DASHSCOPE_API_KEY
)
$ErrorActionPreference = "Stop"
if (-not $ApiKey) {
  Write-Error "Set DASHSCOPE_API_KEY or pass -ApiKey"
}
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$body = Join-Path $here "dashscope-test-body.json"
curl.exe -sS -w "`nHTTP_CODE:%{http_code}`n" `
  -X POST "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" `
  -H "Authorization: Bearer $ApiKey" `
  -H "Content-Type: application/json" `
  --data-binary "@$body"
