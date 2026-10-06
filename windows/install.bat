@echo off
rem One-time setup. Asks for administrator rights (needed for the firewall rule).
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0install.ps1\"'"
