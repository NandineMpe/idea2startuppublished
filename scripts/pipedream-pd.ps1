# Pipedream CLI wrapper (Windows). Uses pd on PATH, or %USERPROFILE%\.local\bin\pipedream-cli\pd.exe
$ErrorActionPreference = "Stop"
$localPd = Join-Path $env:USERPROFILE ".local\bin\pipedream-cli\pd.exe"
if (Test-Path $localPd) {
  & $localPd @args
  exit $LASTEXITCODE
}
$cmd = Get-Command pd -ErrorAction SilentlyContinue
if ($cmd) {
  & $cmd.Source @args
  exit $LASTEXITCODE
}
Write-Error "pd not found. Install: download https://cli.pipedream.com/windows/amd64/latest/pd.zip and extract to $env:USERPROFILE\.local\bin\pipedream-cli\"
exit 127
