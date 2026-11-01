@echo off
title Zero-Lag Trading Platform
echo ========================================================
echo   Starting Zero-Lag Trading Platform (MoneyControl Engine)
echo   URL: http://localhost:4000
echo ========================================================
echo.
cd /d "%~dp0"
start "" http://localhost:4000
node server/src/index.js
pause
