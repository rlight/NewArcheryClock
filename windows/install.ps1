# One-time setup for the New ArcheryClock on a Windows 11 PC. Run install.bat (it asks for admin rights).
#  - installs Node.js LTS with winget if it is missing
#  - opens the clock's port in Windows Firewall for Private networks (so phones/tablets can reach the control page)
#  - adds "Archery Clock" shortcuts to the desktop and, optionally, to start-up
#  - optionally stops the screen from sleeping while plugged in
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$port = 8765

Write-Host "New ArcheryClock setup`n" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Installing Node.js LTS...'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
Write-Host ("Node.js: " + (node --version))

$ruleName = "New ArcheryClock (TCP $port)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
  Write-Host "Firewall: allowed TCP $port on Private networks."
  Write-Host "  (If the range Wi-Fi is set to 'Public' in Windows, set it to 'Private' or phones cannot connect.)" -ForegroundColor Yellow
}

$shell = New-Object -ComObject WScript.Shell
function New-Shortcut($path) {
  $s = $shell.CreateShortcut($path)
  $s.TargetPath = Join-Path $PSScriptRoot 'start-clock.bat'
  $s.WorkingDirectory = $root
  $s.WindowStyle = 7
  $s.IconLocation = "$env:SystemRoot\System32\shell32.dll,265"
  $s.Description = 'Start the Archery Clock'
  $s.Save()
}
New-Shortcut (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Archery Clock.lnk')
Write-Host 'Desktop shortcut: Archery Clock'

if ((Read-Host 'Start the clock automatically when Windows starts? (y/N)') -match '^[yY]') {
  # all-users Startup folder: works whichever account signs in (this script runs as admin,
  # so the per-user folder could be the admin's, not the range account's)
  Get-ChildItem 'C:\Users\*\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Archery Clock.lnk' -ErrorAction SilentlyContinue | Remove-Item -ErrorAction SilentlyContinue
  New-Shortcut (Join-Path ([Environment]::GetFolderPath('CommonStartup')) 'Archery Clock.lnk')
  Write-Host 'Added to start-up for all users (C:\ProgramData\...\StartUp).'
}
if ((Read-Host 'Keep the screen on (no sleep) while plugged in? (Y/n)') -notmatch '^[nN]') {
  powercfg /change monitor-timeout-ac 0
  powercfg /change standby-timeout-ac 0
  Write-Host 'Screen and sleep timeouts on mains power set to Never.'
}
Write-Host "`nDone. Double-click 'Archery Clock' on the desktop to start." -ForegroundColor Green
Read-Host 'Press Enter'
