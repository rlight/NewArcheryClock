@echo off
rem Start the Archery Clock automatically when anyone signs in (asks for admin rights).
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0autostart.ps1\" on'"
