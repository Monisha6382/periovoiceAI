@echo off
title PerioVoice AI Appium Mobile E2E Test Suite
echo ========================================================
echo   PerioVoice AI - Appium Mobile E2E Test Suite Runner
echo ========================================================
echo.
cd /d "%~dp0"
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo Starting Appium Mobile E2E Tests...
echo.
npx wdio run wdio.conf.js
echo.
echo ========================================================
echo   Appium Mobile Test Execution Finished!
echo ========================================================
pause
