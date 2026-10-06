# Turns "start the Archery Clock when Windows starts" on or off for EVERY user of this PC.
# Uses the all-users Startup folder (C:\ProgramData\...\StartUp), so it works whichever account
# signs in, and removes any older per-user shortcut so the clock never starts twice.
# Needs administrator rights (the .bat files ask for them).
param([ValidateSet('on', 'off')][string]$Mode = 'on')
$common = [Environment]::GetFolderPath('CommonStartup')
$lnk = Join-Path $common 'Archery Clock.lnk'
# old per-user shortcuts (any profile) from earlier versions
Get-ChildItem 'C:\Users\*\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Archery Clock.lnk' -ErrorAction SilentlyContinue |
  Remove-Item -ErrorAction SilentlyContinue
try {
  if ($Mode -eq 'off') {
    Remove-Item $lnk -ErrorAction SilentlyContinue
    Write-Host 'Auto-start is OFF: the clock will not start with Windows.' -ForegroundColor Yellow
  } else {
    $shell = New-Object -ComObject WScript.Shell
    $s = $shell.CreateShortcut($lnk)
    $s.TargetPath = Join-Path $PSScriptRoot 'start-clock.bat'
    $s.WorkingDirectory = Split-Path -Parent $PSScriptRoot
    $s.WindowStyle = 7
    $s.IconLocation = "$env:SystemRoot\System32\shell32.dll,265"
    $s.Description = 'Start the Archery Clock'
    $s.Save()
    Write-Host 'Auto-start is ON for all users: the clock starts when anyone signs in.' -ForegroundColor Green
    Write-Host "  Shortcut: $lnk"
    Write-Host '  Also check Settings > Apps > Startup that "Archery Clock" is On.'
    Write-Host '  It runs after someone signs in. For an unattended PC, turn on automatic sign-in (netplwiz).'
  }
} catch {
  Write-Host "Could not change auto-start: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Run this again and allow administrator access.'
}
Read-Host 'Press Enter'
