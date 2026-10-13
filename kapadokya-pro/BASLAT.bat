@echo off
chcp 65001 >nul
title Kapadokya Beat Vadisi PRO
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\baslat.ps1"
echo.
echo Sunucu durdu. Pencereyi kapatabilirsin.
pause
