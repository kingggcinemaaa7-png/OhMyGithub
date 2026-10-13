@echo off
chcp 65001 >nul
title Kapadokya Beat Vadisi PRO - Simulasyon
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\baslat.ps1" -Sim
pause
