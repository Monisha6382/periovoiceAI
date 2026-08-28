@echo off
title PerioVoice AI Selenium E2E Test Suite
echo ========================================================
echo   PerioVoice AI - Selenium E2E Test Suite Runner
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

echo Running Selenium E2E Tests via Mocha...
echo.
npx mocha login-tests.js --reporter spec
echo.
echo ========================================================
echo   Test Execution Finished!
echo ========================================================
pause
