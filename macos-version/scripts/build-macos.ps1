$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..\..")

if (-not $IsMacOS) {
  Write-Host "macOS installer builds should run on macOS."
  Write-Host "Current platform is not macOS, so this script will stop before packaging."
  Write-Host "You can still run 'pnpm build' on Windows to verify the shared Electron code."
  exit 1
}

Set-Location $rootDir

pnpm install
pnpm --filter image-tool build
pnpm --filter image-tool exec electron-builder `
  --config ../../macos-version/electron-builder.macos.yml `
  --mac dmg zip `
  --universal `
  --publish never
