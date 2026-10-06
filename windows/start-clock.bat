@echo off
rem Double-click to start the Archery Clock: server + full-screen display.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-clock.ps1" %*
