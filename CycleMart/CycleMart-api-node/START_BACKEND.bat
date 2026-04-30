@echo off
echo ========================================
echo   CycleMart Node.js Backend Starter
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Checking if node_modules exists...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)
echo.

echo Starting CycleMart Node.js Backend...
echo Backend will run on: http://localhost:3001
echo API endpoints: http://localhost:3001/api/
echo Uploads served from: http://localhost:3001/uploads/
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node src/server.js

pause
