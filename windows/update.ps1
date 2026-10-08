# Installs a downloaded NewArcheryClock update. Started by the server (server/updater.js) from a copy
# in data\update\, after the zip's SHA-256 has been verified. Never touches data\.
param(
  [string]$AppDir, [string]$Zip, [int]$ServerPid, [int]$Port,
  [string]$OldVersion, [string]$NewVersion, [string]$DataDir
)
$ErrorActionPreference = 'Continue'
$log = Join-Path $DataDir 'update.log'
function Log($m) { Add-Content -Path $log -Value ("{0:yyyy-MM-ddTHH:mm:ssZ} [helper] {1}" -f (Get-Date).ToUniversalTime(), $m) }

function Test-Version($v) {
  try { (Invoke-RestMethod "http://127.0.0.1:$Port/api/info" -TimeoutSec 3).version -eq $v } catch { $false }
}
function Start-Server {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { Log 'node.exe not found'; return $null }
  $env:ARCHERYCLOCK_DATA = $DataDir
  Start-Process -FilePath $node -ArgumentList "`"$AppDir\server\server.js`"" -WorkingDirectory $AppDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $DataDir 'server.log') -RedirectStandardError (Join-Path $DataDir 'server-error.log')
}
function Wait-Version($v) { for ($i = 0; $i -lt 60; $i++) { if (Test-Version $v) { return $true }; Start-Sleep -Milliseconds 500 }; $false }
function Get-AppItems { Get-ChildItem -LiteralPath $AppDir -Force | Where-Object { $_.Name -notin @('data', 'backup') } }

Log "installing $OldVersion -> $NewVersion"
for ($i = 0; $i -lt 30 -and (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }
if (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue) { Log 'old server still running; stopping it'; Stop-Process -Id $ServerPid -Force; Start-Sleep 1 }

$stage = Join-Path $DataDir 'update\new'
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
try { Expand-Archive -LiteralPath $Zip -DestinationPath $stage -Force -ErrorAction Stop }
catch { Log "unzip failed: $($_.Exception.Message); starting $OldVersion again"; Start-Server | Out-Null; exit 1 }
$src = Join-Path $stage 'NewArcheryClock'
if (-not (Test-Path $src)) { $src = $stage }
if (-not (Test-Path (Join-Path $src 'server\server.js'))) { Log "zip has no server\server.js; starting $OldVersion again"; Start-Server | Out-Null; exit 1 }

$bk = Join-Path $AppDir "backup\$OldVersion"
Remove-Item -LiteralPath $bk -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $bk | Out-Null
Get-AppItems | ForEach-Object { Move-Item -LiteralPath $_.FullName -Destination $bk -Force }
Copy-Item -Path (Join-Path $src '*') -Destination $AppDir -Recurse -Force
Log "files replaced; starting $NewVersion"
$proc = Start-Server
if (Wait-Version $NewVersion) {
  Log "update to $NewVersion OK"
  # keep the two most recent backups
  Get-ChildItem (Join-Path $AppDir 'backup') -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip 2 |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
  exit 0
}

Log "$NewVersion did not come up; restoring $OldVersion"
if ($proc) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }
Get-AppItems | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
Copy-Item -Path (Join-Path $bk '*') -Destination $AppDir -Recurse -Force
Start-Server | Out-Null
if (Wait-Version $OldVersion) { Log "restored $OldVersion" } else { Log "restore started but $OldVersion is not answering; check server-error.log" }
exit 1
