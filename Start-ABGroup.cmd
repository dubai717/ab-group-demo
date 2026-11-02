@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\windows\Start-ABGroup.ps1" %*
if errorlevel 1 pause
