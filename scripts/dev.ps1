$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeVersion = "16.20.2"
$nodeHome = Join-Path $env:LOCALAPPDATA "nvm\v$nodeVersion"
$npmCmd = Join-Path $nodeHome "npm.cmd"

if (-not (Test-Path $npmCmd)) {
  Write-Error "Node $nodeVersion is missing at $nodeHome. Install it first with nvm."
}

# Keep this session clean from proxy/offline/node-only overrides that broke startup.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:NPM_CONFIG_OFFLINE = "false"
$env:Path = "$nodeHome;$env:Path"

Set-Location $repoRoot
& $npmCmd start
