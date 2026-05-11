$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$versionFile = Join-Path $repoRoot ".nvmrc"
$defaultNodeVersion = "16.20.2"
$nodeVersion = $defaultNodeVersion

if (Test-Path $versionFile) {
  $fileVersion = (Get-Content $versionFile | Select-Object -First 1).Trim()
  if ($fileVersion) {
    $nodeVersion = $fileVersion.TrimStart("v")
  }
}

# Prefer an explicit nvm-windows installation, but fall back to whatever node is already active on PATH.
$nodeHomeCandidates = @()
if ($env:NVM_HOME) {
  $nodeHomeCandidates += (Join-Path $env:NVM_HOME "v$nodeVersion")
}
if ($env:LOCALAPPDATA) {
  $nodeHomeCandidates += (Join-Path $env:LOCALAPPDATA "nvm\v$nodeVersion")
}

$nodeHome = $null
$npmCmd = $null
foreach ($candidate in $nodeHomeCandidates | Select-Object -Unique) {
  $candidateNpm = Join-Path $candidate "npm.cmd"
  if (Test-Path $candidateNpm) {
    $nodeHome = $candidate
    $npmCmd = $candidateNpm
    break
  }
}

if (-not $npmCmd -and $env:ProgramFiles) {
  $programFilesNodeHome = Join-Path $env:ProgramFiles "nodejs"
  $programFilesNpm = Join-Path $programFilesNodeHome "npm.cmd"
  if (Test-Path $programFilesNpm) {
    $nodeHome = $programFilesNodeHome
    $npmCmd = $programFilesNpm
  }
}

if (-not $npmCmd) {
  $npmPath = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmPath) {
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue
  }

  if ($npmPath) {
    $npmCmd = $npmPath.Source
  }
}

if (-not $npmCmd) {
  $nvmHint = if ($env:NVM_HOME) { "$env:NVM_HOME\v$nodeVersion" } else { Join-Path $env:LOCALAPPDATA "nvm\v$nodeVersion" }
  Write-Error "Node $nodeVersion is not available. Install it with nvm-windows (expected at $nvmHint) or put node/npm on PATH."
}

# Keep this session clean from proxy/offline/node-only overrides that broke startup.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:NPM_CONFIG_OFFLINE = "false"
if ($nodeHome) {
  $env:Path = "$nodeHome;$env:Path"
}

Set-Location $repoRoot
& $npmCmd start
