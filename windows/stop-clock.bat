@echo off
rem Stops the Archery Clock server and closes the kiosk display.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*server\server.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force };" ^
  "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*NewArcheryClock*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo Archery Clock stopped.
