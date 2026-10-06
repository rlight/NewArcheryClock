# Starts the New ArcheryClock server (hidden) and opens the display full screen in Edge kiosk mode.
# Windows mirrors that one window to every attached range monitor ("Duplicate these displays").
# Exit the display with Alt+F4. Stop everything with stop-clock.bat.
param([switch]$NoDisplay)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $data | Out-Null
# one line per launch, so it's easy to see whether auto-start ran
Add-Content -Path (Join-Path $data 'start.log') -Value ("{0:yyyy-MM-dd HH:mm:ss} start-clock ({1})" -f (Get-Date), $(if ($NoDisplay) { 'no display' } else { 'with display' })) -ErrorAction SilentlyContinue

$port = 8765
$settingsFile = Join-Path $data 'settings.json'
if (Test-Path $settingsFile) {
  try { $port = (Get-Content $settingsFile -Raw | ConvertFrom-Json).server.port } catch { }
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host 'Node.js is not installed. Run install.bat first.' -ForegroundColor Red; Read-Host 'Press Enter'; exit 1 }

# Start the server unless it is already answering
# 127.0.0.1, not "localhost": Windows tries IPv6 first and takes ~2 s to give up on a refused port
function Test-Clock { try { $null -ne (Invoke-RestMethod "http://127.0.0.1:$port/api/info" -TimeoutSec 3).urls } catch { $false } }
if (-not (Test-Clock)) {
  $log = Join-Path $data 'server.log'
  Start-Process -FilePath $node -ArgumentList "`"$root\server\server.js`"" -WorkingDirectory $root `
    -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError (Join-Path $data 'server-error.log')
  for ($i = 0; $i -lt 40 -and -not (Test-Clock); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Clock)) {
    Write-Host "The clock server did not answer on http://127.0.0.1:$port/" -ForegroundColor Red
    Write-Host "Server output ($data\server.log):"; Get-Content $log -Tail 15 -ErrorAction SilentlyContinue
    Write-Host "Errors ($data\server-error.log):"; Get-Content (Join-Path $data 'server-error.log') -Tail 15 -ErrorAction SilentlyContinue
    Read-Host 'Press Enter'; exit 1
  }
}

if ($NoDisplay) { exit 0 }

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
$url = "http://127.0.0.1:$port/display/"
if (-not $edge) { Start-Process $url; exit 0 }

# A dedicated browser profile, so kiosk mode never collides with a normal Edge window.
$profileDir = Join-Path $env:LOCALAPPDATA 'NewArcheryClock\edge-profile'
Start-Process -FilePath $edge -ArgumentList @(
  '--kiosk', $url, '--edge-kiosk-type=fullscreen', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate', "--user-data-dir=`"$profileDir`""
)
