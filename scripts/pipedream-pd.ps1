# Pipedream CLI wrapper (Windows). Resolution order:
#   1. $env:PIPEDREAM_PD_EXE if set
#   2. %USERPROFILE%\.local\bin\pipedream-cli\pd.exe
#   3. %USERPROFILE%\pipedream-bin\pd.exe
#   4. `pd` on PATH
$ErrorActionPreference = "Stop"

if ($env:PIPEDREAM_PD_EXE -and (Test-Path $env:PIPEDREAM_PD_EXE)) {
  & $env:PIPEDREAM_PD_EXE @args
  exit $LASTEXITCODE
}

$localPd = Join-Path $env:USERPROFILE ".local\bin\pipedream-cli\pd.exe"
if (Test-Path $localPd) {
  & $localPd @args
  exit $LASTEXITCODE
}

$userBinPd = Join-Path $env:USERPROFILE "pipedream-bin\pd.exe"
if (Test-Path $userBinPd) {
  & $userBinPd @args
  exit $LASTEXITCODE
}

$cmd = Get-Command pd -ErrorAction SilentlyContinue
if ($cmd) {
  & $cmd.Source @args
  exit $LASTEXITCODE
}

Write-Error @"
pd not found. Install one of:
  - Download https://cli.pipedream.com/windows/amd64/latest/pd.zip and extract to $env:USERPROFILE\.local\bin\pipedream-cli\
  - Or set PIPEDREAM_PD_EXE to the full path of pd.exe
"@
exit 127
