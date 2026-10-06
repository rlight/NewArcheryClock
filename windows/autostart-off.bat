@echo off
rem Stop the Archery Clock starting automatically with Windows (asks for admin rights).
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0autostart.ps1\" off'"
